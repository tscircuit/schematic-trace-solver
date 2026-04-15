import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-9
/**
 * Maximum perpendicular distance between two parallel segments for them to be
 * considered "close enough" to snap together.
 */
const GAP_THRESHOLD = 0.05
/**
 * Minimum fraction of the shorter segment's length that must overlap in the
 * parallel direction for a merge to be applied.
 */
const MIN_OVERLAP_FRACTION = 0.3

interface Segment {
  traceId: string
  segIndex: number // index of the first point of this segment in the tracePath
  p1: Point
  p2: Point
  isHorizontal: boolean
}

function isHorizontalSeg(p1: Point, p2: Point): boolean {
  return Math.abs(p2.y - p1.y) < EPS
}

function isVerticalSeg(p1: Point, p2: Point): boolean {
  return Math.abs(p2.x - p1.x) < EPS
}

/**
 * Collect all axis-aligned segments from a trace path.
 */
function collectSegments(trace: SolvedTracePath): Segment[] {
  const segs: Segment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i + 1]
    if (isHorizontalSeg(p1, p2)) {
      segs.push({
        traceId: trace.mspPairId,
        segIndex: i,
        p1,
        p2,
        isHorizontal: true,
      })
    } else if (isVerticalSeg(p1, p2)) {
      segs.push({
        traceId: trace.mspPairId,
        segIndex: i,
        p1,
        p2,
        isHorizontal: false,
      })
    }
  }
  return segs
}

/**
 * Returns the 1-D overlap length of intervals [a1,a2] and [b1,b2].
 * Intervals are normalised so a1 ≤ a2, b1 ≤ b2 internally.
 */
function overlapLength(a1: number, a2: number, b1: number, b2: number): number {
  const lo1 = Math.min(a1, a2)
  const hi1 = Math.max(a1, a2)
  const lo2 = Math.min(b1, b2)
  const hi2 = Math.max(b1, b2)
  return Math.max(0, Math.min(hi1, hi2) - Math.max(lo1, lo2))
}

/**
 * The SameNetTraceMergeSolver snaps close, parallel trace segments that belong
 * to the same electrical net onto the same axis-aligned coordinate.
 *
 * When two traces share the same net and have parallel segments that are nearly
 * co-linear (within GAP_THRESHOLD) and sufficiently overlapping
 * (MIN_OVERLAP_FRACTION of the shorter segment), both segments are snapped to
 * their shared median coordinate so they visually merge into one line.
 *
 * This implements the feature requested in:
 * - https://github.com/tscircuit/schematic-trace-solver/issues/29
 * - https://github.com/tscircuit/schematic-trace-solver/issues/34
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  private traces: SolvedTracePath[]
  private outputTraces: SolvedTracePath[]

  constructor(params: { allTraces: SolvedTracePath[] }) {
    super()
    this.traces = params.allTraces
    this.outputTraces = params.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath.map((p) => ({ ...p }))],
    }))
  }

  override _step(): void {
    this._mergeCloseSegments()
    this.solved = true
  }

  private _mergeCloseSegments(): void {
    // Group traces by their electrical net
    const byNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const netId = trace.globalConnNetId
      if (!byNet.has(netId)) byNet.set(netId, [])
      byNet.get(netId)!.push(trace)
    }

    for (const [, netTraces] of byNet) {
      if (netTraces.length < 2) continue
      this._mergeNet(netTraces)
    }
  }

  private _mergeNet(netTraces: SolvedTracePath[]): void {
    // Collect all segments across all traces in this net
    const allSegments: Segment[] = []
    for (const trace of netTraces) {
      allSegments.push(...collectSegments(trace))
    }

    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const a = allSegments[i]
        const b = allSegments[j]
        if (a.traceId === b.traceId) continue // same trace, skip
        if (a.isHorizontal !== b.isHorizontal) continue // different orientation

        if (a.isHorizontal) {
          this._tryMergeHorizontal(a, b)
        } else {
          this._tryMergeVertical(a, b)
        }
      }
    }
  }

  private _tryMergeHorizontal(a: Segment, b: Segment): void {
    const yDiff = Math.abs(a.p1.y - b.p1.y)
    if (yDiff < EPS || yDiff > GAP_THRESHOLD) return

    const segLen = (s: Segment) =>
      Math.abs(s.p2.x - s.p1.x)
    const shorter = segLen(a) < segLen(b) ? a : b
    const overlap = overlapLength(a.p1.x, a.p2.x, b.p1.x, b.p2.x)
    if (overlap < MIN_OVERLAP_FRACTION * segLen(shorter)) return

    // Snap both to the median Y
    const medianY = (a.p1.y + b.p1.y) / 2
    this._snapSegmentY(a.traceId, a.segIndex, medianY)
    this._snapSegmentY(b.traceId, b.segIndex, medianY)
  }

  private _tryMergeVertical(a: Segment, b: Segment): void {
    const xDiff = Math.abs(a.p1.x - b.p1.x)
    if (xDiff < EPS || xDiff > GAP_THRESHOLD) return

    const segLen = (s: Segment) =>
      Math.abs(s.p2.y - s.p1.y)
    const shorter = segLen(a) < segLen(b) ? a : b
    const overlap = overlapLength(a.p1.y, a.p2.y, b.p1.y, b.p2.y)
    if (overlap < MIN_OVERLAP_FRACTION * segLen(shorter)) return

    // Snap both to the median X
    const medianX = (a.p1.x + b.p1.x) / 2
    this._snapSegmentX(a.traceId, a.segIndex, medianX)
    this._snapSegmentX(b.traceId, b.segIndex, medianX)
  }

  /**
   * Snap both endpoints of a horizontal segment (at segIndex) to the given Y
   * coordinate, also adjusting the adjacent points to maintain connectivity.
   */
  private _snapSegmentY(
    traceId: string,
    segIndex: number,
    y: number,
  ): void {
    const trace = this.outputTraces.find((t) => t.mspPairId === traceId)
    if (!trace) return
    const path = trace.tracePath
    // Move this segment's endpoints to the new Y
    path[segIndex].y = y
    path[segIndex + 1].y = y
  }

  /**
   * Snap both endpoints of a vertical segment (at segIndex) to the given X
   * coordinate.
   */
  private _snapSegmentX(
    traceId: string,
    segIndex: number,
    x: number,
  ): void {
    const trace = this.outputTraces.find((t) => t.mspPairId === traceId)
    if (!trace) return
    const path = trace.tracePath
    path[segIndex].x = x
    path[segIndex + 1].x = x
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const lines: GraphicsObject["lines"] = []
    for (const trace of this.outputTraces) {
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        lines!.push({
          points: [trace.tracePath[i], trace.tracePath[i + 1]],
          strokeColor: "blue",
        })
      }
    }
    return { lines }
  }
}
