import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"

/**
 * A trace segment is a pair of consecutive points within a tracePath.
 */
interface TraceSegment {
  traceIndex: number
  segIndex: number
  x1: number
  y1: number
  x2: number
  y2: number
  /** "h" for horizontal (same Y), "v" for vertical (same X) */
  orientation: "h" | "v"
}

const TOLERANCE = 1e-6

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < TOLERANCE
}

/**
 * MergeSameNetTracesSolver — Phase that merges trace segments that belong to
 * the same net and lie on the same axis (same Y for horizontal segments, same X
 * for vertical segments) when those segments overlap or touch.
 *
 * After running, traces that were previously separate but co-linear and
 * overlapping are unified into fewer, longer segments, reducing visual clutter.
 */
export class MergeSameNetTracesSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    inputTraces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.outputTraces = []
  }

  override _step() {
    this.outputTraces = mergeSameNetTraces(this.inputTraces)
    this.solved = true
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []

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

/**
 * Core algorithm: given a flat list of solved trace paths, return a new list
 * where same-net co-linear overlapping/touching segments have been merged.
 *
 * Strategy:
 * 1. Group traces by their globalConnNetId (net name).
 * 2. Within each net, extract all individual horizontal and vertical segments.
 * 3. Cluster segments by axis value (Y for horizontal, X for vertical) with
 *    tolerance, then within each cluster merge overlapping/touching 1-D intervals.
 * 4. Replace the original trace paths with the merged result.  We keep the
 *    merged segments as traces whose mspPairId is derived from the first
 *    contributing trace (so downstream solvers still have stable IDs).
 */
export function mergeSameNetTraces(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  // Group traces by net id
  const byNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!byNet.has(netId)) byNet.set(netId, [])
    byNet.get(netId)!.push(trace)
  }

  const result: SolvedTracePath[] = []

  for (const [, netTraces] of byNet) {
    if (netTraces.length <= 1) {
      // Nothing to merge within a single-trace net
      result.push(...netTraces)
      continue
    }

    // Collect all segments across all traces in this net
    const hSegs: TraceSegment[] = [] // horizontal (constant Y)
    const vSegs: TraceSegment[] = [] // vertical   (constant X)
    const diagonalSegs: TraceSegment[] = [] // non-orthogonal (pass through)

    for (let ti = 0; ti < netTraces.length; ti++) {
      const path = netTraces[ti].tracePath
      for (let si = 0; si + 1 < path.length; si++) {
        const p1 = path[si]
        const p2 = path[si + 1]

        if (approxEqual(p1.y, p2.y)) {
          hSegs.push({
            traceIndex: ti,
            segIndex: si,
            x1: Math.min(p1.x, p2.x),
            y1: p1.y,
            x2: Math.max(p1.x, p2.x),
            y2: p1.y,
            orientation: "h",
          })
        } else if (approxEqual(p1.x, p2.x)) {
          vSegs.push({
            traceIndex: ti,
            segIndex: si,
            x1: p1.x,
            y1: Math.min(p1.y, p2.y),
            x2: p1.x,
            y2: Math.max(p1.y, p2.y),
            orientation: "v",
          })
        } else {
          diagonalSegs.push({
            traceIndex: ti,
            segIndex: si,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            orientation: "h", // placeholder, won't be used for merging
          })
        }
      }
    }

    // Merge horizontal segments that share the same Y and whose X ranges overlap/touch
    const mergedHSegs = mergeCollinearSegments(hSegs, "h")
    // Merge vertical segments that share the same X and whose Y ranges overlap/touch
    const mergedVSegs = mergeCollinearSegments(vSegs, "v")

    // Rebuild traces: we need to reassemble a per-trace path from the
    // (possibly merged) segments.  Our approach: we reconstruct trace paths
    // from the merged segments.  Each group of merged segments becomes one
    // "virtual" trace path attached to the first original trace's metadata.
    //
    // We identify which original traces contributed to each merged segment
    // group and produce one output trace per group, preserving the rest of the
    // original trace's segments (diagonals, unaffected orthogonal segments, etc).
    //
    // For simplicity we use a two-pass approach:
    //   Pass 1: collect all merged segment lines (as {x1,y1,x2,y2} records)
    //           keyed to their contributing trace indices.
    //   Pass 2: rebuild each original trace's path replacing old segments with
    //           their merged counterparts where applicable, then deduplicate
    //           traces that have become identical (because their segments were
    //           absorbed into another trace's merged segment).

    // Build a lookup: (traceIndex, segIndex) → merged segment
    interface MergedSeg {
      x1: number
      y1: number
      x2: number
      y2: number
      orientation: "h" | "v"
      contributors: Array<{ traceIndex: number; segIndex: number }>
    }

    const segReplacementMap = new Map<
      string, // key: `${traceIndex}:${segIndex}`
      MergedSeg
    >()

    for (const ms of [...mergedHSegs, ...mergedVSegs]) {
      for (const c of ms.contributors) {
        segReplacementMap.set(`${c.traceIndex}:${c.segIndex}`, ms)
      }
    }

    // For each original trace, reconstruct its path
    // If a segment was absorbed into a larger merged segment that involves
    // OTHER traces, we may need to drop this trace's contribution entirely
    // (because the merged segment will be emitted by the "primary" trace —
    // the one with the lowest traceIndex).
    const primaryTraceForMergedSeg = new Map<MergedSeg, number>()
    for (const ms of [...mergedHSegs, ...mergedVSegs]) {
      // Primary trace = first contributing trace (lowest index)
      const primary = ms.contributors.reduce(
        (min, c) => Math.min(min, c.traceIndex),
        Infinity,
      )
      primaryTraceForMergedSeg.set(ms, primary)
    }

    // Track which merged segs have already been emitted
    const emittedMergedSegs = new Set<MergedSeg>()

    const rebuiltTraces: SolvedTracePath[] = []

    for (let ti = 0; ti < netTraces.length; ti++) {
      const originalTrace = netTraces[ti]
      const path = originalTrace.tracePath
      if (path.length === 0) {
        rebuiltTraces.push(originalTrace)
        continue
      }

      const newPoints: Point[] = []
      let i = 0

      // Start with first point of the original path
      newPoints.push({ x: path[0].x, y: path[0].y })

      for (let si = 0; si + 1 < path.length; si++) {
        const key = `${ti}:${si}`
        const ms = segReplacementMap.get(key)

        if (!ms) {
          // Not merged — keep the original next point
          newPoints.push({ x: path[si + 1].x, y: path[si + 1].y })
          continue
        }

        const isPrimary = primaryTraceForMergedSeg.get(ms) === ti

        if (!emittedMergedSegs.has(ms)) {
          if (isPrimary) {
            emittedMergedSegs.add(ms)
            // Emit the merged segment endpoints
            if (ms.orientation === "h") {
              // Replace last newPoints with the start of merged seg if needed
              newPoints[newPoints.length - 1] = { x: ms.x1, y: ms.y1 }
              newPoints.push({ x: ms.x2, y: ms.y2 })
            } else {
              newPoints[newPoints.length - 1] = { x: ms.x1, y: ms.y1 }
              newPoints.push({ x: ms.x2, y: ms.y2 })
            }
          } else {
            // Non-primary: emit the merged segment from here too — the segment
            // hasn't been emitted yet and we're not primary.  We still emit
            // it for this trace to keep connectivity (it may be trimmed later).
            emittedMergedSegs.add(ms)
            if (ms.orientation === "h") {
              newPoints[newPoints.length - 1] = { x: ms.x1, y: ms.y1 }
              newPoints.push({ x: ms.x2, y: ms.y2 })
            } else {
              newPoints[newPoints.length - 1] = { x: ms.x1, y: ms.y1 }
              newPoints.push({ x: ms.x2, y: ms.y2 })
            }
          }
        } else {
          // Already emitted by another trace — this trace's segment is now
          // redundant.  Skip this segment by continuing without adding a point
          // (effectively collapsing it).  We may also need to remove the
          // leading point if the whole remaining path is now empty.
          // We do not add the endpoint of this segment.
        }
      }

      // Remove consecutive duplicate points
      const dedupedPoints = deduplicatePoints(newPoints)

      if (dedupedPoints.length < 2) {
        // Trace became a point — drop it entirely (it was fully absorbed)
        continue
      }

      rebuiltTraces.push({
        ...originalTrace,
        tracePath: dedupedPoints,
      })
    }

    result.push(...rebuiltTraces)
  }

  return result
}

/**
 * Given an array of co-linear segments (all horizontal or all vertical),
 * cluster them by their axis value (Y for horizontal, X for vertical) within
 * TOLERANCE, then merge overlapping/touching intervals within each cluster.
 *
 * Returns an array of merged segments, each carrying the list of contributors.
 */
function mergeCollinearSegments(
  segs: TraceSegment[],
  orientation: "h" | "v",
): Array<{
  x1: number
  y1: number
  x2: number
  y2: number
  orientation: "h" | "v"
  contributors: Array<{ traceIndex: number; segIndex: number }>
}> {
  if (segs.length === 0) return []

  // axis value: Y for horizontal, X for vertical
  const axisVal = (s: TraceSegment) => (orientation === "h" ? s.y1 : s.x1)
  const rangeStart = (s: TraceSegment) =>
    orientation === "h" ? s.x1 : s.y1
  const rangeEnd = (s: TraceSegment) => (orientation === "h" ? s.x2 : s.y2)

  // Sort by axis value then range start
  const sorted = [...segs].sort((a, b) => {
    const da = axisVal(a) - axisVal(b)
    if (Math.abs(da) > TOLERANCE) return da
    return rangeStart(a) - rangeStart(b)
  })

  const merged: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    orientation: "h" | "v"
    contributors: Array<{ traceIndex: number; segIndex: number }>
  }> = []

  let i = 0
  while (i < sorted.length) {
    const current = sorted[i]
    const axis = axisVal(current)

    // Collect all segments with the same axis value (within tolerance)
    const group: TraceSegment[] = []
    while (i < sorted.length && approxEqual(axisVal(sorted[i]), axis)) {
      group.push(sorted[i])
      i++
    }

    // Sort group by range start
    group.sort((a, b) => rangeStart(a) - rangeStart(b))

    // Merge overlapping/touching intervals within the group
    let j = 0
    while (j < group.length) {
      const seg = group[j]
      let mergedStart = rangeStart(seg)
      let mergedEnd = rangeEnd(seg)
      const contributors: Array<{ traceIndex: number; segIndex: number }> = [
        { traceIndex: seg.traceIndex, segIndex: seg.segIndex },
      ]

      // Find all overlapping/touching segments
      while (
        j + 1 < group.length &&
        rangeStart(group[j + 1]) <= mergedEnd + TOLERANCE
      ) {
        j++
        const next = group[j]
        if (rangeEnd(next) > mergedEnd) {
          mergedEnd = rangeEnd(next)
        }
        contributors.push({ traceIndex: next.traceIndex, segIndex: next.segIndex })
      }

      // Only record as a merged segment if it actually merged multiple contributors
      // (single-contributor segments don't need special handling)
      if (orientation === "h") {
        merged.push({
          x1: mergedStart,
          y1: axis,
          x2: mergedEnd,
          y2: axis,
          orientation: "h",
          contributors,
        })
      } else {
        merged.push({
          x1: axis,
          y1: mergedStart,
          x2: axis,
          y2: mergedEnd,
          orientation: "v",
          contributors,
        })
      }

      j++
    }
  }

  return merged
}

function deduplicatePoints(points: Point[]): Point[] {
  if (points.length === 0) return []
  const result: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]
    if (!approxEqual(points[i].x, prev.x) || !approxEqual(points[i].y, prev.y)) {
      result.push(points[i])
    }
  }
  return result
}
