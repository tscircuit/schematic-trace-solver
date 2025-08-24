import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { calculateElbow } from "calculate-elbow"
import { getPinDirection } from "./getPinDirection"

export class SchematicTraceSingleLineSolver extends BaseSolver {
  pins: MspConnectionPair["pins"]
  inputProblem: InputProblem
  guidelines: Guideline[]
  chipMap: Record<string, InputChip>

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
    const [pin1, pin2] = this.pins

    this.solvedTracePath = calculateElbow(
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

    // TODO check for collisions

    this.solved = true
    // TODO: Implement
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (this.solvedTracePath) {
      for (const point of this.solvedTracePath) {
        graphics.lines!.push({
          points: this.solvedTracePath,
          strokeColor: "green",
        })
      }
    }

    return graphics
  }
}
