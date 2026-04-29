import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "../../types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import { alignSameNetTraces } from "../TraceCleanupSolver/alignSameNetTraces"

export interface SameNetTraceAlignmentSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  snapThreshold?: number
}

/**
 * SameNetTraceAlignmentSolver is a dedicated solver for aligning parallel trace segments
 * belonging to the same net. It uses weighted averaging and spatial clustering for
 * superior stability and visual cleanliness.
 */
export class SameNetTraceAlignmentSolver extends BaseSolver {
  private input: SameNetTraceAlignmentSolverInput
  private outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceAlignmentSolverInput) {
    super()
    this.input = input
    this.outputTraces = [...input.traces]
  }

  override _step() {
    this.outputTraces = alignSameNetTraces(this.outputTraces, {
      snapThreshold: this.input.snapThreshold,
    })
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const lines = this.outputTraces.map((trace) => ({
      points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
      strokeColor: "blue",
    }))
    return { lines }
  }
}
