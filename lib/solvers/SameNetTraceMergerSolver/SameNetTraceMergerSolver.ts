import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"

interface SameNetTraceMergerSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  threshold?: number
}

/**
 * SameNetTraceMergerSolver snaps nearly-collinear same-net trace segments
 * to the same coordinate, eliminating slight offsets introduced by routing.
 * Horizontal segments close in Y and vertical segments close in X are merged.
 * Runs after traceCleanupSolver in the pipeline.
 */
export class SameNetTraceMergerSolver extends BaseSolver {
  private input: SameNetTraceMergerSolverInput
  outputTraces: SolvedTracePath[]
  readonly threshold: number

  constructor(input: SameNetTraceMergerSolverInput) {
    super()
    this.input = input
    this.threshold = input.threshold ?? 0.15
    this.outputTraces = input.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ x: p.x, y: p.y })),
    }))
  }

  override _step() {
    this._mergeCollinearSegments()
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  private _mergeCollinearSegments() {
    const netGroups = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i]!.globalConnNetId
      if (!netGroups.has(netId)) netGroups.set(netId, [])
      netGroups.get(netId)!.push(i)
    }
    for (const traceIndices of netGroups.values()) {
      if (traceIndices.length < 2) continue
      for (let a = 0; a < traceIndices.length; a++) {
        for (let b = a + 1; b < traceIndices.length; b++) {
          this._trySnapTraces(traceIndices[a]!, traceIndices[b]!)
        }
      }
    }
  }

  /**
   * Compare every segment of trace A against every segment of trace B.
   * Snap collinear overlapping segments to their average coordinate.
   */
  private _trySnapTraces(idxA: number, idxB: number) {
    const pathA = this.outputTraces[idxA]!.tracePath
    const pathB = this.outputTraces[idxB]!.tracePath
    for (let i = 0; i < pathA.length - 1; i++) {
      const a1 = pathA[i]!
      const a2 = pathA[i + 1]!
      const isHorizA = Math.abs(a1.y - a2.y) < 1e-6
      const isVertA = Math.abs(a1.x - a2.x) < 1e-6
      if (!isHorizA && !isVertA) continue
      for (let j = 0; j < pathB.length - 1; j++) {
        const b1 = pathB[j]!
        const b2 = pathB[j + 1]!
        if (isHorizA && Math.abs(b1.y - b2.y) < 1e-6) {
          const dy = Math.abs(a1.y - b1.y)
          if (dy > 1e-6 && dy < this.threshold) {
            const xMinA = Math.min(a1.x, a2.x)
            const xMaxA = Math.max(a1.x, a2.x)
            const xMinB = Math.min(b1.x, b2.x)
            const xMaxB = Math.max(b1.x, b2.x)
            if (xMinA < xMaxB && xMinB < xMaxA) {
              const avgY = (a1.y + b1.y) / 2
              a1.y = avgY
              a2.y = avgY
              b1.y = avgY
              b2.y = avgY
            }
          }
        } else if (isVertA && Math.abs(b1.x - b2.x) < 1e-6) {
          const dx = Math.abs(a1.x - b1.x)
          if (dx > 1e-6 && dx < this.threshold) {
            const yMinA = Math.min(a1.y, a2.y)
            const yMaxA = Math.max(a1.y, a2.y)
            const yMinB = Math.min(b1.y, b2.y)
            const yMaxB = Math.max(b1.y, b2.y)
            if (yMinA < yMaxB && yMinB < yMaxA) {
              const avgX = (a1.x + b1.x) / 2
              a1.x = avgX
              a2.x = avgX
              b1.x = avgX
              b2.x = avgX
            }
          }
        }
      }
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    if (!graphics.lines) graphics.lines = []
    if (!graphics.points) graphics.points = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []
    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      }
      graphics.lines!.push(line)
    }
    return graphics
  }
}
