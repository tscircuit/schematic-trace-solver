import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

interface Point {
  x: number
  y: number
}

/**
 * A segment extracted from a tracePath with back-references so we can
 * mutate the owning trace in place.
 */
interface TraceSegment {
  traceId: string
  segIdx: number // index of the first point in tracePath
  x1: number
  y1: number
  x2: number
  y2: number
  isHorizontal: boolean // true → horizontal (same Y), false → vertical (same X)
}

export interface SameNetTraceAlignmentSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  /** Max perpendicular distance between two parallel segments to snap them. */
  snapThreshold?: number
}

/**
 * Merges same-net trace segments that are close and parallel by snapping
 * them to the same X (vertical) or Y (horizontal) coordinate.
 *
 * This eliminates the "ladder" visual artifact described in issue #34 where
 * two nearly-identical horizontal (or vertical) traces on the same net are
 * rendered as separate parallel lines a fraction of a unit apart.
 */
export class SameNetTraceAlignmentSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  snapThreshold: number

  private queue: Array<{ netId: string; traceIds: string[] }>
  private traceMap: Map<string, SolvedTracePath>

  constructor(params: SameNetTraceAlignmentSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.snapThreshold = params.snapThreshold ?? 0.4
    // Deep-copy tracePaths so we don't mutate upstream data
    this.traces = params.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
    this.outputTraces = this.traces
    this.traceMap = new Map(this.traces.map((t) => [t.mspPairId, t]))

    // Group traces by globalConnNetId
    const byNet = new Map<string, string[]>()
    for (const trace of this.traces) {
      const net = trace.globalConnNetId
      if (!byNet.has(net)) byNet.set(net, [])
      byNet.get(net)!.push(trace.mspPairId)
    }
    this.queue = Array.from(byNet.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([netId, traceIds]) => ({ netId, traceIds }))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceAlignmentSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      snapThreshold: this.snapThreshold,
    }
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override _step() {
    const next = this.queue.shift()
    if (!next) {
      this.solved = true
      return
    }

    const { traceIds } = next
    const segments = this._extractSegments(traceIds)

    const horizontal = segments.filter((s) => s.isHorizontal)
    const vertical = segments.filter((s) => !s.isHorizontal)

    this._alignGroup(horizontal, true)
    this._alignGroup(vertical, false)
  }

  /**
   * Extract all axis-aligned segments from the given trace IDs.
   */
  private _extractSegments(traceIds: string[]): TraceSegment[] {
    const out: TraceSegment[] = []
    for (const id of traceIds) {
      const trace = this.traceMap.get(id)
      if (!trace) continue
      const pts = trace.tracePath
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!
        const b = pts[i + 1]!
        const dx = Math.abs(b.x - a.x)
        const dy = Math.abs(b.y - a.y)
        if (dx < 1e-9 && dy < 1e-9) continue // zero-length
        if (dy < 1e-6) {
          // horizontal
          out.push({
            traceId: id,
            segIdx: i,
            x1: Math.min(a.x, b.x),
            y1: a.y,
            x2: Math.max(a.x, b.x),
            y2: a.y,
            isHorizontal: true,
          })
        } else if (dx < 1e-6) {
          // vertical
          out.push({
            traceId: id,
            segIdx: i,
            x1: a.x,
            y1: Math.min(a.y, b.y),
            x2: a.x,
            y2: Math.max(a.y, b.y),
            isHorizontal: false,
          })
        }
      }
    }
    return out
  }

  /**
   * For horizontal segments, snap pairs whose Y values are within threshold
   * AND whose X ranges overlap.
   * For vertical segments, swap X↔Y and do the same.
   */
  private _alignGroup(segs: TraceSegment[], isHorizontal: boolean) {
    if (segs.length < 2) return

    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]!
        const b = segs[j]!
        if (a.traceId === b.traceId) continue // never snap within the same trace

        const perpDist = isHorizontal
          ? Math.abs(a.y1 - b.y1)
          : Math.abs(a.x1 - b.x1)

        if (perpDist > this.snapThreshold || perpDist < 1e-9) continue

        // Check overlap in the parallel axis
        const aLo = isHorizontal ? a.x1 : a.y1
        const aHi = isHorizontal ? a.x2 : a.y2
        const bLo = isHorizontal ? b.x1 : b.y1
        const bHi = isHorizontal ? b.x2 : b.y2

        const overlapLo = Math.max(aLo, bLo)
        const overlapHi = Math.min(aHi, bHi)
        if (overlapHi - overlapLo < 1e-9) continue // no overlap

        // Snap both segments to the average perpendicular coordinate
        const target = ((isHorizontal ? a.y1 : a.x1) + (isHorizontal ? b.y1 : b.x1)) / 2

        this._snapSegmentPerp(a, target, isHorizontal)
        this._snapSegmentPerp(b, target, isHorizontal)

        // Update the cached segment objects so subsequent passes see new coords
        if (isHorizontal) {
          a.y1 = target
          a.y2 = target
          b.y1 = target
          b.y2 = target
        } else {
          a.x1 = target
          a.x2 = target
          b.x1 = target
          b.x2 = target
        }
      }
    }
  }

  /**
   * Move all points in the segment's trace that share the segment's current
   * perpendicular coordinate to `target`.
   */
  private _snapSegmentPerp(
    seg: TraceSegment,
    target: number,
    isHorizontal: boolean,
  ) {
    const trace = this.traceMap.get(seg.traceId)
    if (!trace) return
    const pts = trace.tracePath
    const oldPerp = isHorizontal ? seg.y1 : seg.x1

    for (const pt of pts) {
      const perp = isHorizontal ? pt.y : pt.x
      if (Math.abs(perp - oldPerp) < 1e-6) {
        if (isHorizontal) pt.y = target
        else pt.x = target
      }
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTraces) {
      const color = getColorFromString(trace.globalConnNetId, 0.75)
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        graphics.lines!.push({
          points: [trace.tracePath[i]!, trace.tracePath[i + 1]!],
          strokeColor: color,
        })
      }
    }

    return graphics
  }
}
