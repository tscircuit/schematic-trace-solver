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
import { getColorFromString } from "lib/utils/getColorFromString"

export class SchematicTraceSingleLineSolver extends BaseSolver {
  pins: MspConnectionPair["pins"]
  inputProblem: InputProblem
  guidelines: Guideline[]
  chipMap: Record<string, InputChip>
  movableSegments: Array<MovableSegment>
  baseElbow: Point[]

  queuedCandidatePaths: Array<Point[]>

  chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  solvedTracePath: { x: number; y: number }[] | null = null

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

    this.queuedCandidatePaths = [this.baseElbow, ...elbowVariants]
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

    for (let i = 0; i < nextCandidatePath.length - 1; i++) {
      const start = nextCandidatePath[i]
      const end = nextCandidatePath[i + 1]

      // Determine which chips to exclude for this specific segment
      let excludeChipIds: string[] = []

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
        if (startPin && !excludeChipIds.includes(startPin.chipId)) {
          excludeChipIds.push(startPin.chipId)
        }
      }

      if (isEndPin) {
        const endPin = this.pins.find(
          (pin) =>
            Math.abs(pin.x - end.x) < 1e-10 && Math.abs(pin.y - end.y) < 1e-10,
        )
        if (endPin && !excludeChipIds.includes(endPin.chipId)) {
          excludeChipIds.push(endPin.chipId)
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
          strokeWidth: boundsWidth * 0.005,
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
