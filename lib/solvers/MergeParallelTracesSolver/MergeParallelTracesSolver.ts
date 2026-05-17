import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import {
  DEFAULT_MERGE_DISTANCE,
  mergeParallelTraceSegments,
} from "./mergeParallelTraceSegments"

export class MergeParallelTracesSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  mergeDistance: number

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: SolvedTracePath[]
    mergeDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE

    for (const tracePath of this.inputTracePaths) {
      this.correctedTraceMap[tracePath.mspPairId] = {
        ...tracePath,
        tracePath: tracePath.tracePath.map((point) => ({ ...point })),
        mspConnectionPairIds: [...tracePath.mspConnectionPairIds],
        pinIds: [...tracePath.pinIds],
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof MergeParallelTracesSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      mergeDistance: this.mergeDistance,
    }
  }

  override _step() {
    const merged = mergeParallelTraceSegments(
      this.inputTracePaths,
      this.mergeDistance,
    )

    this.correctedTraceMap = Object.fromEntries(
      merged.map((trace) => [trace.mspPairId, trace]),
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
