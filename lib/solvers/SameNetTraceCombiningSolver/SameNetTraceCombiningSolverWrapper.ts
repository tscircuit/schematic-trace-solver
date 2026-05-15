import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SameNetTraceCombiningSolver } from "./SameNetTraceCombiningSolver"

export interface SameNetTraceCombiningSolverWrapperParams {
  traces: SolvedTracePath[]
  proximityThreshold?: number
}

/**
 * Wrapper that integrates SameNetTraceCombiningSolver into the pipeline.
 * Runs after trace cleanup to merge parallel segments on the same net.
 */
export class SameNetTraceCombiningSolverWrapper extends BaseSolver {
  private params: SameNetTraceCombiningSolverWrapperParams
  output: SolvedTracePath[] = []

  constructor(params: SameNetTraceCombiningSolverWrapperParams) {
    super()
    this.params = params
    this.MAX_ITERATIONS = 1
  }

  override _step() {
    const solver = new SameNetTraceCombiningSolver({
      traces: this.params.traces,
      proximityThreshold: this.params.proximityThreshold ?? 0.5,
    })
    const result = solver.solve()
    this.output = result.traces
    this.stats.combinedCount = result.combinedCount
    this.solved = true
  }

  override getOutput(): { traces: SolvedTracePath[]; combinedCount: number } {
    return {
      traces: this.output,
      combinedCount: this.stats.combinedCount ?? 0,
    }
  }
}
