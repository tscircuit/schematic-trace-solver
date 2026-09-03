import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { removeGroundTracesCrossingMultipleNets } from "./removeGroundTracesCrossingMultipleNets"

interface GroundTraceCrossingLabelSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

/** Replaces automatically routed ground wires with endpoint labels when they cross multiple nets. */
export class GroundTraceCrossingLabelSolver extends BaseSolver {
  private input: GroundTraceCrossingLabelSolverInput
  outputTraces: SolvedTracePath[]
  removedGroundTraceIds = new Set<string>()

  constructor(input: GroundTraceCrossingLabelSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
  }

  override _step() {
    const result = removeGroundTracesCrossingMultipleNets({
      inputProblem: this.input.inputProblem,
      traces: this.input.traces,
    })
    this.outputTraces = result.outputTraces
    this.removedGroundTraceIds = result.removedGroundTraceIds
    this.stats.removedGroundTraceCount = this.removedGroundTraceIds.size
    this.solved = true
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem)
    graphics.lines ??= []
    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }
    return graphics
  }
}
