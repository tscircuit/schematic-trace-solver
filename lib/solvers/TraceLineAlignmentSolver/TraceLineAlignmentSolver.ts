import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * After trace lines are generated, same-net horizontal or vertical
 * segments that are very close in the perpendicular axis should be
 * "snapped" to the same coordinate so they appear visually aligned.
 *
 * This is a post-processing step — it runs after all traces have been
 * routed and simply adjusts coordinates in-place.
 *
 * Threshold: segments whose perpendicular distance is within
 * `alignThreshold` (default 0.15mm) are snapped to the median coordinate.
 */

const DEFAULT_ALIGN_THRESHOLD = 0.15

type Axis = "x" | "y"

interface Segment {
  traceIdx: number
  segIdx: number
  start: Point
  end: Point
  axis: Axis // "x" for horizontal, "y" for vertical
  fixed: number // the coordinate that stays the same
  variable: number // the coordinate that will be aligned
}

export class TraceLineAlignmentSolver extends BaseSolver {
  outputTraces: SolvedTracePath[]
  alignThreshold: number
  alignedCount = 0

  constructor({
    traces,
    alignThreshold = DEFAULT_ALIGN_THRESHOLD,
  }: {
    traces: SolvedTracePath[]
    alignThreshold?: number
  }) {
    super()
    this.outputTraces = traces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))
    this.alignThreshold = alignThreshold
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override _step(): void {
    // Extract all axis-aligned segments from all traces
    const segments: Segment[] = []

    for (let ti = 0; ti < this.outputTraces.length; ti++) {
      const path = this.outputTraces[ti]!.tracePath
      for (let si = 0; si < path.length - 1; si++) {
        const a = path[si]!
        const b = path[si + 1]!

        if (Math.abs(a.y - b.y) < 1e-9) {
          // horizontal segment
          segments.push({
            traceIdx: ti,
            segIdx: si,
            start: a,
            end: b,
            axis: "x",
            fixed: a.y,
            variable: a.y, // y is the variable we want to align
          })
        } else if (Math.abs(a.x - b.x) < 1e-9) {
          // vertical segment
          segments.push({
            traceIdx: ti,
            segIdx: si,
            start: a,
            end: b,
            axis: "y",
            fixed: a.x,
            variable: a.x, // x is the variable we want to align
          })
        }
      }
    }

    // Group segments by axis direction
    const horizontals = segments.filter((s) => s.axis === "x")
    const verticals = segments.filter((s) => s.axis === "y")

    // Align horizontal segments (snap Y coordinates)
    this.alignSegments(horizontals, "y")

    // Align vertical segments (snap X coordinates)
    this.alignSegments(verticals, "x")

    this.solved = true
  }

  private alignSegments(segments: Segment[], variableAxis: Axis): void {
    if (segments.length < 2) return

    // Group segments that are "close" in the perpendicular (variable) axis
    // and whose "fixed" axis ranges overlap
    const used = new Set<number>()

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue

      const group: number[] = [i]
      used.add(i)

      const si = segments[i]!

      // Find segments close to this one
      for (let j = i + 1; j < segments.length; j++) {
        if (used.has(j)) continue

        const sj = segments[j]!

        // Check if perpendicular distance is within threshold
        const perpDist = Math.abs(si.variable - sj.variable)
        if (perpDist > this.alignThreshold || perpDist < 1e-9) continue

        // Check if the segments overlap in the fixed axis
        const siMin = Math.min(si.start[si.axis], si.end[si.axis])
        const siMax = Math.max(si.start[si.axis], si.end[si.axis])
        const sjMin = Math.min(sj.start[sj.axis], sj.end[sj.axis])
        const sjMax = Math.max(sj.start[sj.axis], sj.end[sj.axis])

        if (siMin <= sjMax + 0.01 && sjMin <= siMax + 0.01) {
          group.push(j)
          used.add(j)
        }
      }

      if (group.length < 2) continue

      // Compute the median variable coordinate for the group
      const values = group.map((idx) => segments[idx]!.variable)
      values.sort((a, b) => a - b)
      const median = values[Math.floor(values.length / 2)]!

      // Snap all segments in the group to the median
      for (const idx of group) {
        const seg = segments[idx]!
        const path = this.outputTraces[seg.traceIdx]!.tracePath
        const prevValue = path[seg.segIdx]![variableAxis]

        if (Math.abs(prevValue - median) > 1e-9) {
          // Update both endpoints of the segment
          path[seg.segIdx]![variableAxis] = median
          path[seg.segIdx + 1]![variableAxis] = median

          // Also update adjacent segments' connecting points
          if (seg.segIdx > 0) {
            path[seg.segIdx - 1]![variableAxis] = median
          }
          if (seg.segIdx + 2 < path.length) {
            path[seg.segIdx + 2]![variableAxis] = median
          }

          this.alignedCount++
        }
      }
    }
  }

  override visualize() {
    const lines: { points: Point[]; color?: string }[] = []

    for (const trace of this.outputTraces) {
      if (trace.tracePath.length > 1) {
        lines.push({ points: trace.tracePath, color: "blue" })
      }
    }

    return {
      lines,
      points: [],
      rects: [],
      circles: [],
    }
  }
}
