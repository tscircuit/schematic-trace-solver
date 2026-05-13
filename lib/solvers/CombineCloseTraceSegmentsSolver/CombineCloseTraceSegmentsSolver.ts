import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-6

interface CombineCloseTraceSegmentsSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  closenessTolerance?: number
}

interface SegmentPair {
  traceIdx1: number
  segIdx1: number
  traceIdx2: number
  segIdx2: number
  isVertical: boolean
  sharedMin: number
  sharedMax: number
  coord1: number
  coord2: number
}

/**
 * Combines same-net trace segments that are close together.
 *
 * When two traces on the same net have parallel segments that are near each
 * other (within `closenessTolerance`), this solver shifts them onto the same
 * axis so they share a single visual line instead of two nearly-overlapping
 * ones. This reduces visual clutter in schematic layouts.
 *
 * Only operates within the same globalConnNetId — never merges across nets.
 */
export class CombineCloseTraceSegmentsSolver extends BaseSolver {
  private input: CombineCloseTraceSegmentsSolverInput
  private outputTraces: SolvedTracePath[]
  private closenessTolerance: number
  private netIds: string[]
  private currentNetIdx: number = 0
  private tracesByNet: Record<string, SolvedTracePath[]> = {}

  constructor(solverInput: CombineCloseTraceSegmentsSolverInput) {
    super()
    this.input = solverInput
    this.closenessTolerance = solverInput.closenessTolerance ?? 0.15
    this.outputTraces = solverInput.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))

    // Group traces by net
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!this.tracesByNet[netId]) this.tracesByNet[netId] = []
      this.tracesByNet[netId].push(trace)
    }

    this.netIds = Object.keys(this.tracesByNet).filter(
      (netId) => (this.tracesByNet[netId]?.length ?? 0) > 1,
    )
  }

  override getConstructorParams() {
    return this.input
  }

  /**
   * Find two parallel segments from different traces on the same net that
   * are close together (within tolerance) and overlap in the parallel axis.
   */
  private findCloseSegmentPair(
    traces: SolvedTracePath[],
  ): SegmentPair | null {
    const tol = this.closenessTolerance

    for (let i = 0; i < traces.length; i++) {
      const path1 = traces[i]!.tracePath
      for (let si = 0; si < path1.length - 1; si++) {
        const a1 = path1[si]!
        const a2 = path1[si + 1]!
        const aVert = Math.abs(a1.x - a2.x) < EPS
        const aHorz = Math.abs(a1.y - a2.y) < EPS
        if (!aVert && !aHorz) continue

        for (let j = i + 1; j < traces.length; j++) {
          const path2 = traces[j]!.tracePath
          for (let sj = 0; sj < path2.length - 1; sj++) {
            const b1 = path2[sj]!
            const b2 = path2[sj + 1]!
            const bVert = Math.abs(b1.x - b2.x) < EPS
            const bHorz = Math.abs(b1.y - b2.y) < EPS
            if (!bVert && !bHorz) continue

            if (aVert && bVert) {
              const dist = Math.abs(a1.x - b1.x)
              if (dist > EPS && dist < tol) {
                const overlapMin = Math.max(
                  Math.min(a1.y, a2.y),
                  Math.min(b1.y, b2.y),
                )
                const overlapMax = Math.min(
                  Math.max(a1.y, a2.y),
                  Math.max(b1.y, b2.y),
                )
                if (overlapMax - overlapMin > EPS) {
                  return {
                    traceIdx1: i,
                    segIdx1: si,
                    traceIdx2: j,
                    segIdx2: sj,
                    isVertical: true,
                    sharedMin: overlapMin,
                    sharedMax: overlapMax,
                    coord1: a1.x,
                    coord2: b1.x,
                  }
                }
              }
            } else if (aHorz && bHorz) {
              const dist = Math.abs(a1.y - b1.y)
              if (dist > EPS && dist < tol) {
                const overlapMin = Math.max(
                  Math.min(a1.x, a2.x),
                  Math.min(b1.x, b2.x),
                )
                const overlapMax = Math.min(
                  Math.max(a1.x, a2.x),
                  Math.max(b1.x, b2.x),
                )
                if (overlapMax - overlapMin > EPS) {
                  return {
                    traceIdx1: i,
                    segIdx1: si,
                    traceIdx2: j,
                    segIdx2: sj,
                    isVertical: false,
                    sharedMin: overlapMin,
                    sharedMax: overlapMax,
                    coord1: a1.y,
                    coord2: b1.y,
                  }
                }
              }
            }
          }
        }
      }
    }
    return null
  }

  /**
   * Shift the second trace's segment to align with the first trace's
   * coordinate, adjusting adjacent points to maintain orthogonal routing.
   */
  private alignSegment(
    tracePath: Point[],
    segIdx: number,
    isVertical: boolean,
    targetCoord: number,
  ): void {
    const p1 = tracePath[segIdx]!
    const p2 = tracePath[segIdx + 1]!

    if (isVertical) {
      // Shift X of both endpoints to target
      p1.x = targetCoord
      p2.x = targetCoord
    } else {
      // Shift Y of both endpoints to target
      p1.y = targetCoord
      p2.y = targetCoord
    }
  }

  override _step() {
    if (this.currentNetIdx >= this.netIds.length) {
      this.solved = true
      return
    }

    const netId = this.netIds[this.currentNetIdx]!
    const traces = this.tracesByNet[netId]!

    const pair = this.findCloseSegmentPair(traces)

    if (!pair) {
      // No more close segments in this net, move to next
      this.currentNetIdx++
      return
    }

    // Average the two coordinates for the merge target
    const targetCoord = (pair.coord1 + pair.coord2) / 2

    // Align the second trace's segment to the target
    this.alignSegment(
      traces[pair.traceIdx2]!.tracePath,
      pair.segIdx2,
      pair.isVertical,
      targetCoord,
    )

    // Also align the first trace's segment to the target
    this.alignSegment(
      traces[pair.traceIdx1]!.tracePath,
      pair.segIdx1,
      pair.isVertical,
      targetCoord,
    )

    // Don't advance currentNetIdx — re-check this net for more close segments
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      })
    }

    return graphics
  }
}
