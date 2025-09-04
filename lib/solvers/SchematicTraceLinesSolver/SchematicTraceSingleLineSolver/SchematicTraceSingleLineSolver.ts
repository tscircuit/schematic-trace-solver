import { getBounds, type GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { calculateElbow } from "calculate-elbow"
import { getPinDirection } from "./getPinDirection"
import {
  generateElbowVariants,
  type MovableSegment,
} from "./generateElbowVariants"
import type { Point } from "@tscircuit/math-utils"
import { visualizeGuidelines } from "lib/solvers/GuidelinesSolver/visualizeGuidelines"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"
import { getColorFromString } from "lib/utils/getColorFromString"

export class SchematicTraceSingleLineSolver extends BaseSolver {
  pins: MspConnectionPair["pins"]
  inputProblem: InputProblem
  guidelines: Guideline[]
  chipMap: Record<string, InputChip>
  movableSegments: Array<MovableSegment>
  baseElbow: Point[]

  allCandidatePaths: Array<Point[]>
  queuedCandidatePaths: Array<Point[]>

  chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  solvedTracePath: { x: number; y: number }[] | null = null

  // map of pinId -> pin (with chipId attached)
  pinIdMap: Map<string, any> = new Map()

  constructor(params: {
    pins: MspConnectionPair["pins"]
    guidelines: Guideline[]
    inputProblem: InputProblem
    chipMap: Record<string, InputChip>
  }) {
    super()
    this.pins = params.pins
    this.inputProblem = params.inputProblem
    this.guidelines = params.guidelines
    this.chipMap = params.chipMap
    this.chipObstacleSpatialIndex =
      this.inputProblem._chipObstacleSpatialIndex ||
      new ChipObstacleSpatialIndex(this.inputProblem.chips)

    if (!this.inputProblem._chipObstacleSpatialIndex) {
      this.inputProblem._chipObstacleSpatialIndex =
        this.chipObstacleSpatialIndex
    }

    // Build a lookup of all pins by id and attach chipId to each pin entry
    for (const chip of this.inputProblem.chips) {
      for (const pin of chip.pins) {
        this.pinIdMap.set(pin.pinId, { ...pin, chipId: chip.chipId })
      }
    }

    for (const pin of this.pins) {
      if (!pin._facingDirection) {
        const chip = this.chipMap[pin.chipId]
        pin._facingDirection = getPinDirection(pin, chip)
      }
    }

    const [pin1, pin2] = this.pins
    this.baseElbow = calculateElbow(
      {
        x: pin1.x,
        y: pin1.y,
        facingDirection: pin1._facingDirection,
      },
      {
        x: pin2.x,
        y: pin2.y,
        facingDirection: pin2._facingDirection,
      },
      {
        overshoot: 0.2,
      },
    )

    const { elbowVariants, movableSegments } = generateElbowVariants({
      baseElbow: this.baseElbow,
      guidelines: this.guidelines,
    })

    this.movableSegments = movableSegments

    const getPathLength = (pts: Point[]) => {
      let len = 0
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x
        const dy = pts[i + 1].y - pts[i].y
        len += Math.sqrt(dx * dx + dy * dy)
      }
      return len
    }

    this.allCandidatePaths = [this.baseElbow, ...elbowVariants]
    this.queuedCandidatePaths = [...this.allCandidatePaths].sort(
      (a, b) => getPathLength(a) - getPathLength(b),
    )
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTraceSingleLineSolver
  >[0] {
    return {
      chipMap: this.chipMap,
      pins: this.pins,
      guidelines: this.guidelines,
      inputProblem: this.inputProblem,
    }
  }

  override _step() {
    if (this.queuedCandidatePaths.length === 0) {
      this.failed = true
      this.error = "No more candidate elbows, everything had collisions"
      return
    }

    const nextCandidatePath = this.queuedCandidatePaths.shift()!

    // Determine set of related pin IDs (closure over directConnections) for both endpoints
    const collectDirectClosure = (startPinId: string) => {
      const visited = new Set<string>()
      const queue: string[] = [startPinId]
      visited.add(startPinId)
      const directConns = this.inputProblem.directConnections || []
      while (queue.length) {
        const cur = queue.shift()!
        for (const dc of directConns) {
          if (dc.pinIds.includes(cur)) {
            for (const p of dc.pinIds) {
              if (!visited.has(p)) {
                visited.add(p)
                queue.push(p)
              }
            }
          }
        }
      }
      return visited
    }

    const p0 = this.pins[0].pinId
    const p1 = this.pins[1].pinId
    const relatedPinIds = new Set<string>([
      ...collectDirectClosure(p0),
      ...collectDirectClosure(p1),
    ])

    const restrictedCenters = new Map<
      string,
      { x?: number; y?: number; axes: Set<string> }
    >()

    // Collect facing-signs per chip
    const chipFacingMap = new Map<
      string,
      {
        hasXPos?: boolean
        hasXNeg?: boolean
        hasYPos?: boolean
        hasYNeg?: boolean
        center: { x: number; y: number }
        counts?: { xPos: number; xNeg: number; yPos: number; yNeg: number }
      }
    >()

    const chipsOfFacingPins = new Set<string>(this.pins.map((p) => p.chipId))

    for (const pinId of relatedPinIds) {
      const pin = this.pinIdMap.get(pinId)
      if (!pin) continue
      const chip = this.chipMap[pin.chipId]
      if (!chip) continue
      const facing = pin._facingDirection ?? getPinDirection(pin, chip)
      let entry = chipFacingMap.get(chip.chipId)
      if (!entry) {
        entry = { center: chip.center }

        const counts = { xPos: 0, xNeg: 0, yPos: 0, yNeg: 0 }
        for (const cp of chip.pins) {
          const cpFacing = cp._facingDirection ?? getPinDirection(cp, chip)
          if (cpFacing === "x+") counts.xPos++
          if (cpFacing === "x-") counts.xNeg++
          if (cpFacing === "y+") counts.yPos++
          if (cpFacing === "y-") counts.yNeg++
        }
        entry.counts = counts

        chipFacingMap.set(chip.chipId, entry)
      }
      if (facing === "x+") entry.hasXPos = true
      if (facing === "x-") entry.hasXNeg = true
      if (facing === "y+") entry.hasYPos = true
      if (facing === "y-") entry.hasYNeg = true
    }

    // Only mark a center as restricted on an axis if both signs for that axis
    // are present among related pins on the chip.
    for (const [chipId, faces] of chipFacingMap) {
      const axes = new Set<string>()
      const rc: { x?: number; y?: number; axes: Set<string> } = { axes }

      // determine whether any side on this chip has more than one pin
      const counts = faces.counts
      const anySideHasMultiplePins = !!(
        counts &&
        (counts.xPos > 1 ||
          counts.xNeg > 1 ||
          counts.yPos > 1 ||
          counts.yNeg > 1)
      )

      const skipCenterRestriction =
        !anySideHasMultiplePins && chipsOfFacingPins.has(chipId)

      if (!skipCenterRestriction) {
        if (faces.hasXPos && faces.hasXNeg) {
          rc.x = faces.center.x
          axes.add("x")
        }
        if (faces.hasYPos && faces.hasYNeg) {
          rc.y = faces.center.y
          axes.add("y")
        }
      }

      if (axes.size > 0) {
        restrictedCenters.set(chipId, rc)
      }
    }

    for (let i = 0; i < nextCandidatePath.length - 1; i++) {
      const start = nextCandidatePath[i]
      const end = nextCandidatePath[i + 1]

      // Determine which chips to exclude for this specific segment
      let excludeChipIds: string[] = []

      // If this segment would cross any restricted center line, reject the candidate path.
      const EPS = 1e-9
      for (const [, rc] of restrictedCenters) {
        if (rc.axes.has("x") && typeof rc.x === "number") {
          // segment strictly crosses vertical center line
          if ((start.x - rc.x) * (end.x - rc.x) < -EPS) return
        }
        if (rc.axes.has("y") && typeof rc.y === "number") {
          // segment strictly crosses horizontal center line
          if ((start.y - rc.y) * (end.y - rc.y) < -EPS) return
        }
      }

      // Always exclude chips that contain the start or end points of this segment
      // if those points are actually pin locations
      const isStartPin = this.pins.some(
        (pin) =>
          Math.abs(pin.x - start.x) < 1e-10 &&
          Math.abs(pin.y - start.y) < 1e-10,
      )
      const isEndPin = this.pins.some(
        (pin) =>
          Math.abs(pin.x - end.x) < 1e-10 && Math.abs(pin.y - end.y) < 1e-10,
      )

      if (isStartPin) {
        const startPin = this.pins.find(
          (pin) =>
            Math.abs(pin.x - start.x) < 1e-10 &&
            Math.abs(pin.y - start.y) < 1e-10,
        )
        if (startPin) {
          // Enforce that the first segment does not enter the chip interior.
          const bounds = getInputChipBounds(this.chipMap[startPin.chipId])
          const dx = end.x - start.x
          const dy = end.y - start.y
          const EPS = 1e-9
          const onLeft = Math.abs(start.x - bounds.minX) < 1e-9
          const onRight = Math.abs(start.x - bounds.maxX) < 1e-9
          const onBottom = Math.abs(start.y - bounds.minY) < 1e-9
          const onTop = Math.abs(start.y - bounds.maxY) < 1e-9
          const entersInterior =
            (onLeft && dx > EPS) ||
            (onRight && dx < -EPS) ||
            (onBottom && dy > EPS) ||
            (onTop && dy < -EPS)
          if (entersInterior) return
          if (!excludeChipIds.includes(startPin.chipId)) {
            excludeChipIds.push(startPin.chipId)
          }
        }
      }

      if (isEndPin) {
        const endPin = this.pins.find(
          (pin) =>
            Math.abs(pin.x - end.x) < 1e-10 && Math.abs(pin.y - end.y) < 1e-10,
        )
        if (endPin) {
          // Enforce that the last segment approaches the pin from outside the chip.
          const bounds = getInputChipBounds(this.chipMap[endPin.chipId])
          const dx = start.x - end.x // vector from pin outward toward previous point
          const dy = start.y - end.y
          const EPS = 1e-9
          const onLeft = Math.abs(end.x - bounds.minX) < 1e-9
          const onRight = Math.abs(end.x - bounds.maxX) < 1e-9
          const onBottom = Math.abs(end.y - bounds.minY) < 1e-9
          const onTop = Math.abs(end.y - bounds.maxY) < 1e-9
          const entersInterior =
            (onLeft && dx > EPS) ||
            (onRight && dx < -EPS) ||
            (onBottom && dy > EPS) ||
            (onTop && dy < -EPS)
          if (entersInterior) return
          if (!excludeChipIds.includes(endPin.chipId)) {
            excludeChipIds.push(endPin.chipId)
          }
        }
      }

      const obstacleOps = { excludeChipIds }
      const intersects =
        this.chipObstacleSpatialIndex.doesOrthogonalLineIntersectChip(
          [start, end],
          obstacleOps,
        )
      if (intersects) return
    }

    this.solvedTracePath = nextCandidatePath
    this.solved = true
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    const bounds = getBounds(graphics)
    const boundsWidth = bounds.maxX - bounds.minX
    const boundsHeight = bounds.maxY - bounds.minY
    visualizeGuidelines({ guidelines: this.guidelines, graphics })

    // Visualize movable segments
    for (const { start, end, dir } of this.movableSegments) {
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      const dist = Math.sqrt((start.x - end.x) ** 2 + (start.y - end.y) ** 2)
      graphics.lines!.push({
        points: [start, mid, end],
        strokeColor: "rgba(0,0,255,0.5)",
        strokeDash: "2 2",
      })
      graphics.lines!.push({
        points: [
          mid,
          { x: mid.x + dir.x * dist * 0.1, y: mid.y + dir.y * dist * 0.1 },
        ],
        strokeColor: "rgba(0,0,255,0.5)",
        strokeDash: "2 2",
      })
    }

    // Draw the next candidate path in orange
    if (!this.solvedTracePath) {
      if (this.queuedCandidatePaths.length > 0) {
        graphics.lines!.push({
          points: this.queuedCandidatePaths[0],
          strokeColor: "orange",
        })
      }

      // Visualize all the other queued candidates in faded yellow
      for (let i = 1; i < this.queuedCandidatePaths.length; i++) {
        const candidatePath = this.queuedCandidatePaths[i]
        const pi = i / this.queuedCandidatePaths.length
        graphics.lines!.push({
          points: candidatePath.map((p) => ({
            x: p.x + pi * boundsWidth * 0.005,
            y: p.y + pi * boundsHeight * 0.005,
          })),
          strokeColor: getColorFromString(
            `${candidatePath.reduce((acc, p) => `${acc},${p.x},${p.y}`, "")}`,
            0.5,
          ),
          strokeDash: "8 8",
        })
      }
    }

    if (this.solvedTracePath) {
      graphics.lines!.push({
        points: this.solvedTracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}
