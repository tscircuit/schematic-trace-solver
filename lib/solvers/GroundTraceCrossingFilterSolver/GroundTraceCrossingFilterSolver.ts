import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getGroundTracesToReplaceWithLabels } from "./getGroundTracesToReplaceWithLabels"

interface GroundTraceCrossingFilterSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

export class GroundTraceCrossingFilterSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  removedGroundTraces: SolvedTracePath[] = []

  constructor({ inputProblem, traces }: GroundTraceCrossingFilterSolverInput) {
    super()
    this.inputProblem = inputProblem
    this.inputTraces = traces
    this.outputTraces = traces
  }

  override getConstructorParams(): ConstructorParameters<
    typeof GroundTraceCrossingFilterSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
    }
  }

  override _step() {
    this.removedGroundTraces = getGroundTracesToReplaceWithLabels({
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
    })
    const removedGroundTraceIds = new Set<MspConnectionPairId>(
      this.removedGroundTraces.map((trace) => trace.mspPairId),
    )
    this.outputTraces = this.inputTraces.filter(
      (trace) => !removedGroundTraceIds.has(trace.mspPairId),
    )
    this.stats.removedGroundTraceCount = this.removedGroundTraces.length
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      removedGroundTraces: this.removedGroundTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }
    for (const trace of this.removedGroundTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "red",
        strokeDash: "4 2",
      })
    }
    return graphics
  }
}
