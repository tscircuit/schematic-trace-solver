/**
 * SameNetTraceMergeSolver
 *
 * A dedicated pipeline phase (issue #29) that finds same-net trace segments
 * that are collinear (same X or same Y) and overlapping / contiguous, and
 * merges them into a single trace segment.
 *
 * This runs immediately after SchematicTraceLinesSolver so that downstream
 * solvers (TraceOverlapShiftSolver, NetLabelPlacementSolver, …) operate on a
 * cleaner, deduplicated set of traces.
 */

import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetTraceLines } from "lib/solvers/SchematicTracePipelineSolver/merge-same-net-trace-lines"

export interface SameNetTraceMergeSolverParams {
  inputTracePaths: SolvedTracePath[]
}

export class SameNetTraceMergeSolver extends BaseSolver {
  inputTracePaths: SolvedTracePath[]
  mergedTracePaths: SolvedTracePath[] = []

  constructor({ inputTracePaths }: SameNetTraceMergeSolverParams) {
    super()
    this.inputTracePaths = inputTracePaths
    // This solver completes in a single step.
    this.MAX_ITERATIONS = 1
  }

  override _step() {
    this.mergedTracePaths = mergeSameNetTraceLines(this.inputTracePaths)
    this.solved = true
  }

  getOutput(): { mergedTracePaths: SolvedTracePath[] } {
    return { mergedTracePaths: this.mergedTracePaths }
  }
}
