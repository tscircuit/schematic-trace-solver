/**
 * SameNetMergeSegmentSolver
 *
 * Closes #34 and #29
 *
 * When two traces belong to the same net and have parallel axis-aligned
 * segments that are very close together (within MERGE_THRESHOLD schematic
 * units) AND whose extents overlap, the segments are redundant—they appear
 * as two nearly-identical lines stacked on top of each other.
 *
 * This solver collapses such pairs: both segments are snapped to the same
 * coordinate (the midpoint of the two Y-values for horizontal segments, or
 * the midpoint of the two X-values for vertical segments), and the merged
 * segment's extent is extended to the union of both extents.
 *
 * The solver iterates until no more mergeable pairs are found (fixed-point).
 */

import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "graphics-debug"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

/** Maximum distance (in schematic units) between parallel segments to merge */
const MERGE_THRESHOLD = 0.25

/** Minimum overlap length required to consider two segments mergeable */
const MIN_OVERLAP = 0.01

const EPS = 1e-9

interface Segment {
  traceIdx: number
  segIdx: number
  axis: "h" | "v"
  fixedCoord: number
  lo: number
  hi: number
}

function extractSegments(traces: SolvedTracePath[]): Segment[] {
  const segs: Segment[] = []
  for (let ti = 0; ti < traces.length; ti++) {
    const path = traces[ti]!.tracePath
    for (let si = 0; si < path.length - 1; si++) {
      const p1 = path[si]!
      const p2 = path[si + 1]!
      const dx = Math.abs(p2.x - p1.x)
      const dy = Math.abs(p2.y - p1.y)
      if (dy < EPS && dx > EPS) {
        segs.push({
          traceIdx: ti,
          segIdx: si,
          axis: "h",
          fixedCoord: p1.y,
          lo: Math.min(p1.x, p2.x),
          hi: Math.max(p1.x, p2.x),
        })
      } else if (dx < EPS && dy > EPS) {
        segs.push({
          traceIdx: ti,
          segIdx: si,
          axis: "v",
          fixedCoord: p1.x,
          lo: Math.min(p1.y, p2.y),
          hi: Math.max(p1.y, p2.y),
        })
      }
    }
  }
  return segs
}

function segmentsOverlap(a: Segment, b: Segment): boolean {
  const overlapLo = Math.max(a.lo, b.lo)
  const overlapHi = Math.min(a.hi, b.hi)
  return overlapHi - overlapLo > MIN_OVERLAP
}

function sameNet(a: SolvedTracePath, b: SolvedTracePath): boolean {
  return (
    a.dcConnNetId === b.dcConnNetId || a.globalConnNetId === b.globalConnNetId
  )
}

function applyMerge(
  path: Point[],
  segIdx: number,
  axis: "h" | "v",
  newFixed: number,
  newLo: number,
  newHi: number,
): Point[] {
  const newPath = path.map((p) => ({ ...p }))
  const p1 = newPath[segIdx]!
  const p2 = newPath[segIdx + 1]!

  if (axis === "h") {
    p1.y = newFixed
    p2.y = newFixed
    if (path[segIdx]!.x <= path[segIdx + 1]!.x) {
      p1.x = newLo
      p2.x = newHi
    } else {
      p1.x = newHi
      p2.x = newLo
    }
  } else {
    p1.x = newFixed
    p2.x = newFixed
    if (path[segIdx]!.y <= path[segIdx + 1]!.y) {
      p1.y = newLo
      p2.y = newHi
    } else {
      p1.y = newHi
      p2.y = newLo
    }
  }

  return simplifyPath(newPath)
}

export interface SameNetMergeSegmentSolverInput {
  traces: SolvedTracePath[]
}

export class SameNetMergeSegmentSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetMergeSegmentSolverInput) {
    super()
    this.inputTraces = input.traces
    this.outputTraces = input.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
  }

  private _findAndMergeOne(): boolean {
    const traces = this.outputTraces
    const segs = extractSegments(traces)

    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]!
        const b = segs[j]!

        if (a.axis !== b.axis) continue
        if (a.traceIdx === b.traceIdx) continue
        if (!sameNet(traces[a.traceIdx]!, traces[b.traceIdx]!)) continue
        if (Math.abs(a.fixedCoord - b.fixedCoord) > MERGE_THRESHOLD) continue
        if (!segmentsOverlap(a, b)) continue

        const newFixed = (a.fixedCoord + b.fixedCoord) / 2
        const newLo = Math.min(a.lo, b.lo)
        const newHi = Math.max(a.hi, b.hi)

        traces[a.traceIdx]!.tracePath = applyMerge(
          traces[a.traceIdx]!.tracePath,
          a.segIdx,
          a.axis,
          newFixed,
          newLo,
          newHi,
        )
        traces[b.traceIdx]!.tracePath = applyMerge(
          traces[b.traceIdx]!.tracePath,
          b.segIdx,
          b.axis,
          newFixed,
          newLo,
          newHi,
        )

        return true
      }
    }

    return false
  }

  override _step() {
    const merged = this._findAndMergeOne()
    if (!merged) {
      this.solved = true
    }
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }
}
