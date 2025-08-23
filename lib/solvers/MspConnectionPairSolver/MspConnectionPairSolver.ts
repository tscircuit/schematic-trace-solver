import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"

export type MspConnectionPair = {
  mspPairId: string
  pins: [InputPin, InputPin]
}

export class MspConnectionPairSolver extends BaseSolver {
  mspConnectionPairs: MspConnectionPair[] = []

  constructor(inputProblem: InputProblem) {
    super()

    // Compute the connectivity map to know what networks are connected to each
    // other
    // TODO
  }

  override _step() {
    // TODO: Implement
  }
}
