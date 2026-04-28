import type { GraphicsObject } from "graphics-debug"

export type InputProblem = {
  directConnections: unknown[]
  chips: unknown[]
  components: unknown[]
  obstacles: unknown[]
  allTraces?: unknown[]
}

export class BaseSolver {
  MAX_ITERATIONS = 100e3

  solved = false
  failed = false
  iterations = 0
  progress = 0

  error: string | null = null
  activeSubSolver?: BaseSolver | null
  failedSubSolvers?: BaseSolver[]
  timeToSolve?: number

  stats: Record<string, unknown> = {}

  // Added "?" to make this optional for type-safety
  inputProblem?: InputProblem

  constructor(inputProblem?: InputProblem) {
    this.inputProblem = inputProblem
  }

  step(): void {
    if (this.solved || this.failed) return

    this.iterations++

    try {
      this._step()
    } catch (e) {
      this.error = `${this.constructor.name} error: ${String(e)}`
      this.failed = true
      throw e
    }

    if (!this.solved && this.iterations > this.MAX_ITERATIONS) {
      this.tryFinalAcceptance()
    }

    if (!this.solved && this.iterations > this.MAX_ITERATIONS) {
      this.error = `${this.constructor.name} ran out of iterations`
      this.failed = true
    }

    if (this.hasComputeProgress()) {
      this.progress = this.computeProgress()
    }
  }

  protected _step(): void {}

  getConstructorParams(): unknown {
    throw new Error("getConstructorParams not implemented")
  }

  solve(): void {
    const startTime = Date.now()

    while (!this.solved && !this.failed) {
      this.step()
    }

    const endTime = Date.now()
    this.timeToSolve = endTime - startTime
  }

  visualize(): GraphicsObject {
    return {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
  }

  tryFinalAcceptance(): void {}

  preview(): GraphicsObject {
    return {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }
  }

  private hasComputeProgress(): this is this & {
    computeProgress: () => number
  } {
    return typeof (this as any).computeProgress === "function"
  }
}
