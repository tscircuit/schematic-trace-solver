import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface UntangleTraceSubsolverOutput {
  traces: SolvedTracePath[]
}

export class UntangleTraceSubsolver extends BaseSolver {
  private output: UntangleTraceSubsolverOutput

  constructor(config: { allTraces: SolvedTracePath[] }) {
    super()
    this.output = {
      traces: [...config.allTraces],
    }
  }

  override _step() {
    this.solved = true
  }

  getOutput() {
    return this.output
  }

  override visualize() {
    return {
      lines: [],
      points: [],
      rects: [],
      circles: [],
      texts: [],
    }
  }
}

