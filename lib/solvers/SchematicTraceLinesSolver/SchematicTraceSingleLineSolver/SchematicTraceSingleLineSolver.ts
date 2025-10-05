import { getBounds, type GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type {
  ChipId,
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
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
import { getRestrictedCenterLines } from "./getRestrictedCenterLines"

type ChipPin = InputPin & { chipId: ChipId }

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
  pinIdMap: Map<PinId, ChipPin> = new Map()

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
      maxVariants: 1000,
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

    const restrictedCenterLines = getRestrictedCenterLines({
      pins: this.pins,
      inputProblem: this.inputProblem,
      pinIdMap: this.pinIdMap,
      chipMap: this.chipMap,
    })

    // Check if this candidate path is valid
    let pathIsValid = true

    for (let i = 0; i < nextCandidatePath.length - 1; i++) {
      const start = nextCandidatePath[i]
      const end = nextCandidatePath[i + 1]

      // Determine which chips to exclude for this specific segment
      let excludeChipIds: string[] = []

      // If this segment would cross any restricted center line, reject the candidate path.
      const EPS = 1e-9
      for (const [, rcl] of restrictedCenterLines) {
        const bounds = rcl.bounds
        if (rcl.axes.has("x") && typeof rcl.x === "number") {
          // segment strictly crosses vertical center line near the chip bounds
          if ((start.x - rcl.x) * (end.x - rcl.x) < -EPS) {
            const segMinY = Math.min(start.y, end.y)
            const segMaxY = Math.max(start.y, end.y)
            const overlapY =
              Math.min(segMaxY, bounds.maxY) - Math.max(segMinY, bounds.minY)
            if (overlapY > EPS) {
              pathIsValid = false
              break
            }
          }
        }
        if (rcl.axes.has("y") && typeof rcl.y === "number") {
          // segment strictly crosses horizontal center line near the chip bounds
          if ((start.y - rcl.y) * (end.y - rcl.y) < -EPS) {
            const segMinX = Math.min(start.x, end.x)
            const segMaxX = Math.max(start.x, end.x)
            const overlapX =
              Math.min(segMaxX, bounds.maxX) - Math.max(segMinX, bounds.minX)
            if (overlapX > EPS) {
              pathIsValid = false
              break
            }
          }
        }
      }

      if (!pathIsValid) break

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
          if (entersInterior) {
            pathIsValid = false
            break
          }
          if (!excludeChipIds.includes(startPin.chipId)) {
            excludeChipIds.push(startPin.chipId)
          }
        }
      }

      if (!pathIsValid) break

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
          if (entersInterior) {
            pathIsValid = false
            break
          }
          if (!excludeChipIds.includes(endPin.chipId)) {
            excludeChipIds.push(endPin.chipId)
          }
        }
      }

      if (!pathIsValid) break

      const obstacleOps = { excludeChipIds }
      const intersects =
        this.chipObstacleSpatialIndex.doesOrthogonalLineIntersectChip(
          [start, end],
          obstacleOps,
        )
      if (intersects) {
        pathIsValid = false
        break
      }
    }

    // If this path is valid, use it as the solution
    if (pathIsValid) {
      this.solvedTracePath = nextCandidatePath
      this.solved = true
    }
    // If this path is invalid, continue to next step to try the next candidate
    // The next _step() call will try the next candidate path
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
