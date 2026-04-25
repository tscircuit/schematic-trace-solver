import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"

/**
 * SameNetTraceAlignmentSolver — Phase to snap close same-net trace segments
 * to the exact same X or Y coordinate (issue #34).
 *
 * When two horizontal segments in the same net have Y values within
 * SNAP_THRESHOLD, we snap both to the average Y.  Likewise for vertical
 * segments and X values.  This eliminates the subtle "almost-aligned" traces
 * that appear as parallel lines in the rendered schematic.
 */

const SNAP_THRESHOLD = 0.15 // schematic units

interface Segment {
  traceIdx: number
  segIdx: number
  /** start/end indices into the tracePath array */
  p0idx: number
  p1idx: number
  x0: number
  y0: number
  x1: number
  y1: number
  /** "H" for horizontal, "V" for vertical, "D" for diagonal */
  orientation: "H" | "V" | "D"
  netKey: string
}

export interface SameNetTraceAlignmentSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

export class SameNetTraceAlignmentSolver extends BaseSolver {
  private input: SameNetTraceAlignmentSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceAlignmentSolverInput) {
    super()
    this.input = input
    // Deep-clone traces so we don't mutate upstream data
    this.outputTraces = input.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
  }

  override _step() {
    this.outputTraces = this._alignSameNetSegments(this.outputTraces)
    this.solved = true
  }

  private _getNetKey(trace: SolvedTracePath): string {
    return trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId
  }

  private _buildSegments(traces: SolvedTracePath[]): Segment[] {
    const segments: Segment[] = []
    for (let ti = 0; ti < traces.length; ti++) {
      const trace = traces[ti]!
      const path = trace.tracePath
      const netKey = this._getNetKey(trace)
      for (let si = 0; si + 1 < path.length; si++) {
        const p0 = path[si]!
        const p1 = path[si + 1]!
        const dx = Math.abs(p1.x - p0.x)
        const dy = Math.abs(p1.y - p0.y)
        let orientation: "H" | "V" | "D" = "D"
        if (dy < 1e-9) orientation = "H"
        else if (dx < 1e-9) orientation = "V"

        segments.push({
          traceIdx: ti,
          segIdx: si,
          p0idx: si,
          p1idx: si + 1,
          x0: p0.x,
          y0: p0.y,
          x1: p1.x,
          y1: p1.y,
          orientation,
          netKey,
        })
      }
    }
    return segments
  }

  private _rangeOverlap(
    a0: number,
    a1: number,
    b0: number,
    b1: number,
  ): number {
    const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1))
    const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1))
    return hi - lo
  }

  private _alignSameNetSegments(traces: SolvedTracePath[]): SolvedTracePath[] {
    const segments = this._buildSegments(traces)

    // Group by netKey + orientation for fast comparison
    const groups: Map<string, Segment[]> = new Map()
    for (const seg of segments) {
      if (seg.orientation === "D") continue
      const key = `${seg.netKey}:${seg.orientation}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(seg)
    }

    // Collect snapping operations to apply: {traceIdx, pointIdx, axis, newValue}
    type Snap = {
      traceIdx: number
      pointIdx: number
      axis: "x" | "y"
      newValue: number
    }
    const snaps: Snap[] = []
    const snapped = new Set<string>() // avoid double-snapping

    for (const [_key, segs] of groups) {
      const orientation = segs[0]!.orientation
      const perpAxis = orientation === "H" ? "y" : "x" // axis to snap
      const sharedAxis = orientation === "H" ? "x" : "y" // axis that defines length

      for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
          const a = segs[i]!
          const b = segs[j]!

          const aPerp = orientation === "H" ? a.y0 : a.x0
          const bPerp = orientation === "H" ? b.y0 : b.x0

          const perpDiff = Math.abs(aPerp - bPerp)
          if (perpDiff < 1e-9 || perpDiff > SNAP_THRESHOLD) continue

          // Require some overlap along the shared axis
          const aLo = Math.min(
            orientation === "H" ? a.x0 : a.y0,
            orientation === "H" ? a.x1 : a.y1,
          )
          const aHi = Math.max(
            orientation === "H" ? a.x0 : a.y0,
            orientation === "H" ? a.x1 : a.y1,
          )
          const bLo = Math.min(
            orientation === "H" ? b.x0 : b.y0,
            orientation === "H" ? b.x1 : b.y1,
          )
          const bHi = Math.max(
            orientation === "H" ? b.x0 : b.y0,
            orientation === "H" ? b.x1 : b.y1,
          )
          const overlap = this._rangeOverlap(aLo, aHi, bLo, bHi)
          const minLen = Math.min(aHi - aLo, bHi - bLo)
          if (minLen < 1e-9 || overlap / minLen < 0.25) continue

          // Snap both to average perpendicular coordinate
          const avgPerp = (aPerp + bPerp) / 2

          for (const seg of [a, b]) {
            for (const pidx of [seg.p0idx, seg.p1idx]) {
              const snapKey = `${seg.traceIdx}:${pidx}:${perpAxis}`
              if (!snapped.has(snapKey)) {
                snapped.add(snapKey)
                snaps.push({
                  traceIdx: seg.traceIdx,
                  pointIdx: pidx,
                  axis: perpAxis,
                  newValue: avgPerp,
                })
              }
            }
          }
        }
      }
    }

    // Apply snaps
    const result: SolvedTracePath[] = traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
    for (const snap of snaps) {
      const pt = result[snap.traceIdx]!.tracePath[snap.pointIdx]!
      if (snap.axis === "x") pt.x = snap.newValue
      else pt.y = snap.newValue
    }

    return result
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const lines = this.outputTraces.map((trace) => ({
      points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
      strokeColor: "blue",
    }))
    return { lines }
  }
}
