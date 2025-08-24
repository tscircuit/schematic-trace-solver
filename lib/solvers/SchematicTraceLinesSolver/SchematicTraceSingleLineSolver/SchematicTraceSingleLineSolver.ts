import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

export class SchematicTraceSingleLineSolver extends BaseSolver {
  pins: MspConnectionPair["pins"]
  inputProblem: InputProblem
  guidelines: Guideline[]

  constructor(params: {
    pins: MspConnectionPair["pins"]
    guidelines: Guideline[]
    inputProblem: InputProblem
  }) {
    super()
    this.pins = params.pins
    this.inputProblem = params.inputProblem
    this.guidelines = params.guidelines
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTraceSingleLineSolver
  >[0] {
    return {
      pins: this.pins,
      guidelines: this.guidelines,
      inputProblem: this.inputProblem,
    }
  }

  override _step() {
    // TODO: Implement
  }

  override visualize(): GraphicsObject {}
}
