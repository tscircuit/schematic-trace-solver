import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import {
  combineSameNetTraceSegments,
  DEFAULT_COMBINE_DISTANCE,
} from "./combineSameNetTraceSegments"

/**
 * Pipeline phase that combines nearby parallel trace segments on the same net
 * by snapping them to a shared X or Y coordinate.
 */
export class TraceCombineSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  combineDistance: number

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: SolvedTracePath[]
    combineDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.combineDistance = params.combineDistance ?? DEFAULT_COMBINE_DISTANCE

    for (const tracePath of this.inputTracePaths) {
      this.correctedTraceMap[tracePath.mspPairId] = tracePath
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceCombineSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      combineDistance: this.combineDistance,
    }
  }

  override _step() {
    const combined = combineSameNetTraceSegments(
      this.inputTracePaths,
      this.combineDistance,
    )

    this.correctedTraceMap = Object.fromEntries(
      combined.map((trace) => [trace.mspPairId, trace]),
    )
    this.solved = true
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: Object.values(this.correctedTraceMap) }
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines = graphics.lines || []

    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "teal",
      })
    }

    return graphics
  }
}
