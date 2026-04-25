import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"

const EPSILON = 1e-6

/**
 * Segment between two consecutive points in a trace path.
 */
interface Segment {
  traceIndex: number
  segmentIndex: number
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * An interval on an axis.
 */
interface Interval {
  lo: number
  hi: number
}

/**
 * Merge overlapping or touching intervals into a minimal set.
 */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.lo - b.lo)
  const result: Interval[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const current = result[result.length - 1]!
    const next = sorted[i]!
    if (next.lo <= current.hi + EPSILON) {
      current.hi = Math.max(current.hi, next.hi)
    } else {
      result.push({ ...next })
    }
  }
  return result
}

/**
 * CollinearTraceMergeSolver merges collinear same-net trace segments.
 *
 * When segments within the same net share the same Y (horizontal segments) or
 * the same X (vertical segments) and their ranges overlap or are adjacent, they
 * are merged into a single segment. This is the simpler sub-case of issue #29:
 * traces already exactly collinear (same X or same Y), not merely "close."
 *
 * Algorithm:
 * 1. Group traces by their globalConnNetId (same net).
 * 2. Collect all segments from each net group, classifying as horizontal or vertical.
 * 3. For horizontal segments at the same Y (within epsilon): merge overlapping
 *    x-intervals using a standard interval-merge algorithm.
 * 4. For vertical segments at the same X (within epsilon): merge overlapping
 *    y-intervals.
 * 5. Rebuild the affected trace paths with redundant intermediate points removed.
 */
export class CollinearTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  constructor(params: { inputProblem: InputProblem; allTraces: SolvedTracePath[] }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.allTraces
    this.outputTraces = []
  }

  override _step() {
    this.outputTraces = this._mergeCollinearSegments(this.inputTraces)
    this.solved = true
  }

  /**
   * Core merge logic. Returns a new array of SolvedTracePath with collinear
   * same-net segments merged.
   */
  private _mergeCollinearSegments(traces: SolvedTracePath[]): SolvedTracePath[] {
    // Group traces by net
    const netGroups: Map<string, SolvedTracePath[]> = new Map()
    for (const trace of traces) {
      const netId = trace.globalConnNetId
      if (!netGroups.has(netId)) netGroups.set(netId, [])
      netGroups.get(netId)!.push(trace)
    }

    // Build a mutable copy of each trace's path
    const tracePaths: Map<string, { x: number; y: number }[]> = new Map()
    for (const trace of traces) {
      tracePaths.set(
        trace.mspPairId,
        trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
      )
    }

    for (const [, netTraces] of netGroups) {
      if (netTraces.length < 2) continue

      // Collect all horizontal segments (same Y) and vertical segments (same X)
      // across all traces in this net.

      // horizontalGroups: key = rounded Y value, value = list of {mspPairId, segIdx, lo, hi}
      const horizontalGroups: Map<
        string,
        Array<{ mspPairId: string; segIdx: number; lo: number; hi: number }>
      > = new Map()
      const verticalGroups: Map<
        string,
        Array<{ mspPairId: string; segIdx: number; lo: number; hi: number }>
      > = new Map()

      for (const trace of netTraces) {
        const path = tracePaths.get(trace.mspPairId)!
        for (let i = 0; i < path.length - 1; i++) {
          const p1 = path[i]!
          const p2 = path[i + 1]!
          const dy = Math.abs(p2.y - p1.y)
          const dx = Math.abs(p2.x - p1.x)

          if (dy < EPSILON) {
            // Horizontal segment
            const yKey = p1.y.toFixed(10)
            if (!horizontalGroups.has(yKey)) horizontalGroups.set(yKey, [])
            horizontalGroups.get(yKey)!.push({
              mspPairId: trace.mspPairId,
              segIdx: i,
              lo: Math.min(p1.x, p2.x),
              hi: Math.max(p1.x, p2.x),
            })
          } else if (dx < EPSILON) {
            // Vertical segment
            const xKey = p1.x.toFixed(10)
            if (!verticalGroups.has(xKey)) verticalGroups.set(xKey, [])
            verticalGroups.get(xKey)!.push({
              mspPairId: trace.mspPairId,
              segIdx: i,
              lo: Math.min(p1.y, p2.y),
              hi: Math.max(p1.y, p2.y),
            })
          }
        }
      }

      // For each horizontal group with more than one segment, attempt merging
      for (const [yKey, segs] of horizontalGroups) {
        if (segs.length < 2) continue
        const y = Number.parseFloat(yKey)
        const intervals: Interval[] = segs.map((s) => ({ lo: s.lo, hi: s.hi }))
        const merged = mergeIntervals(intervals)
        // Only act if the merge actually reduces the number of intervals
        if (merged.length >= segs.length) continue

        // The merged result has fewer intervals — rebuild the traces.
        // We need to replace the segments involved across multiple traces.
        // Strategy: keep the first trace in the group and update it to cover
        // the full merged interval; remove the overlapping portions from
        // the other traces' paths.
        this._applyHorizontalMerge(tracePaths, segs, merged, y)
      }

      // For each vertical group with more than one segment, attempt merging
      for (const [xKey, segs] of verticalGroups) {
        if (segs.length < 2) continue
        const x = Number.parseFloat(xKey)
        const intervals: Interval[] = segs.map((s) => ({ lo: s.lo, hi: s.hi }))
        const merged = mergeIntervals(intervals)
        if (merged.length >= segs.length) continue

        this._applyVerticalMerge(tracePaths, segs, merged, x)
      }
    }

    // Rebuild output traces
    return traces.map((trace) => {
      const newPath = tracePaths.get(trace.mspPairId)!
      if (newPath.length < 2) {
        // Degenerate — keep at least the original two endpoints
        const original = trace.tracePath
        return { ...trace, tracePath: [original[0]!, original[original.length - 1]!] }
      }
      return { ...trace, tracePath: newPath }
    })
  }

  /**
   * Given a set of horizontal segments that all share the same Y and form
   * overlapping/adjacent intervals, apply the merged result.
   *
   * The strategy is:
   * - Remove the segments from their respective trace paths (replace with
   *   a zero-length point if the segment is interior, or trim endpoints).
   * - For each merged interval that wasn't already covered by a single
   *   original segment, update the first participating trace to use the
   *   merged extent, and simplify other participating traces by collapsing
   *   their covered portion.
   */
  private _applyHorizontalMerge(
    tracePaths: Map<string, { x: number; y: number }[]>,
    segs: Array<{ mspPairId: string; segIdx: number; lo: number; hi: number }>,
    merged: Interval[],
    y: number,
  ) {
    // Build one merged interval list that covers all segs.
    // For each merged interval, determine which original segments it covers.
    // A merged interval that covers >1 original segment is what we handle.

    for (const mergedInterval of merged) {
      const covered = segs.filter(
        (s) => s.lo >= mergedInterval.lo - EPSILON && s.hi <= mergedInterval.hi + EPSILON,
      )
      if (covered.length < 2) continue

      // The first covered trace/segment gets the full merged extent.
      const primary = covered[0]!
      const primaryPath = tracePaths.get(primary.mspPairId)!
      // Update the primary segment endpoints to span the full merged interval.
      const p1 = primaryPath[primary.segIdx]!
      const p2 = primaryPath[primary.segIdx + 1]!
      const leftward = p1.x < p2.x
      primaryPath[primary.segIdx] = { x: leftward ? mergedInterval.lo : mergedInterval.hi, y }
      primaryPath[primary.segIdx + 1] = { x: leftward ? mergedInterval.hi : mergedInterval.lo, y }

      // Remove overlapping segments from the other participating traces.
      for (let i = 1; i < covered.length; i++) {
        const seg = covered[i]!
        const path = tracePaths.get(seg.mspPairId)!
        // Collapse the segment to a single point (its start point) to mark
        // it for cleanup. This preserves path topology while making the
        // segment degenerate.
        const segStart = path[seg.segIdx]!
        // Replace the end point of this segment with the start point.
        path[seg.segIdx + 1] = { x: segStart.x, y: segStart.y }
        // Simplify the path by removing consecutive duplicate points.
        tracePaths.set(seg.mspPairId, this._removeCollinearDuplicates(path))
      }
    }
  }

  /**
   * Same as _applyHorizontalMerge but for vertical segments (fixed X).
   */
  private _applyVerticalMerge(
    tracePaths: Map<string, { x: number; y: number }[]>,
    segs: Array<{ mspPairId: string; segIdx: number; lo: number; hi: number }>,
    merged: Interval[],
    x: number,
  ) {
    for (const mergedInterval of merged) {
      const covered = segs.filter(
        (s) => s.lo >= mergedInterval.lo - EPSILON && s.hi <= mergedInterval.hi + EPSILON,
      )
      if (covered.length < 2) continue

      const primary = covered[0]!
      const primaryPath = tracePaths.get(primary.mspPairId)!
      const p1 = primaryPath[primary.segIdx]!
      const p2 = primaryPath[primary.segIdx + 1]!
      const downward = p1.y < p2.y
      primaryPath[primary.segIdx] = { x, y: downward ? mergedInterval.lo : mergedInterval.hi }
      primaryPath[primary.segIdx + 1] = { x, y: downward ? mergedInterval.hi : mergedInterval.lo }

      for (let i = 1; i < covered.length; i++) {
        const seg = covered[i]!
        const path = tracePaths.get(seg.mspPairId)!
        const segStart = path[seg.segIdx]!
        path[seg.segIdx + 1] = { x: segStart.x, y: segStart.y }
        tracePaths.set(seg.mspPairId, this._removeCollinearDuplicates(path))
      }
    }
  }

  /**
   * Remove consecutive duplicate points from a path and collapse zero-length
   * segments, then also remove collinear intermediate points (three consecutive
   * points in a straight line).
   */
  private _removeCollinearDuplicates(
    path: { x: number; y: number }[],
  ): { x: number; y: number }[] {
    if (path.length === 0) return path

    // Step 1: remove consecutive duplicate points
    const deduped: { x: number; y: number }[] = [path[0]!]
    for (let i = 1; i < path.length; i++) {
      const prev = deduped[deduped.length - 1]!
      const curr = path[i]!
      if (Math.abs(curr.x - prev.x) > EPSILON || Math.abs(curr.y - prev.y) > EPSILON) {
        deduped.push(curr)
      }
    }

    if (deduped.length <= 2) return deduped

    // Step 2: remove collinear middle points (three in a straight line)
    const result: { x: number; y: number }[] = [deduped[0]!]
    for (let i = 1; i < deduped.length - 1; i++) {
      const prev = result[result.length - 1]!
      const curr = deduped[i]!
      const next = deduped[i + 1]!
      // Cross product: if zero, collinear
      const cross =
        (curr.x - prev.x) * (next.y - prev.y) -
        (curr.y - prev.y) * (next.x - prev.x)
      if (Math.abs(cross) > EPSILON) {
        result.push(curr)
      }
    }
    result.push(deduped[deduped.length - 1]!)
    return result
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
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
