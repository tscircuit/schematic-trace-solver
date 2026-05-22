import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"

interface SameNetSegmentMergeSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  /**
   * Maximum perpendicular distance between two collinear/parallel segments of
   * the same net before they are considered "close enough" to merge.
   * Defaults to 0.15 schematic units.
   */
  mergeThreshold?: number
}

/**
 * Returns the net id shared by a trace (using dcConnNetId as the canonical net key).
 */
function getNetId(trace: SolvedTracePath): string {
  return trace.dcConnNetId
}

/**
 * Euclidean distance between two points.
 */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/**
 * Returns true if the segment (p1→p2) is horizontal (dy ≈ 0).
 */
function isHorizontal(p1: Point, p2: Point): boolean {
  return Math.abs(p2.y - p1.y) < 1e-9
}

/**
 * Returns true if the segment (p1→p2) is vertical (dx ≈ 0).
 */
function isVertical(p1: Point, p2: Point): boolean {
  return Math.abs(p2.x - p1.x) < 1e-9
}

/**
 * Perpendicular distance from point `p` to the infinite line defined by
 * direction of segment (s1→s2). Works for axis-aligned segments only.
 */
function perpendicularDistance(
  p: Point,
  s1: Point,
  s2: Point,
): number {
  if (isHorizontal(s1, s2)) {
    // horizontal segment → perpendicular distance is |Δy|
    return Math.abs(p.y - s1.y)
  }
  if (isVertical(s1, s2)) {
    // vertical segment → perpendicular distance is |Δx|
    return Math.abs(p.x - s1.x)
  }
  // Non-axis-aligned: general formula
  const dx = s2.x - s1.x
  const dy = s2.y - s1.y
  const len = Math.sqrt(dx * dx + dy * dy)
  return Math.abs(dy * p.x - dx * p.y + s2.x * s1.y - s2.y * s1.x) / len
}

/**
 * Checks whether two collinear 1-D intervals [a0,a1] and [b0,b1] overlap or
 * are within `gap` of each other.
 */
function intervals1DClose(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  gap: number,
): boolean {
  const aMin = Math.min(a0, a1)
  const aMax = Math.max(a0, a1)
  const bMin = Math.min(b0, b1)
  const bMax = Math.max(b0, b1)
  return aMax + gap >= bMin && bMax + gap >= aMin
}

/**
 * Given two overlapping / adjacent same-net horizontal segments, return the
 * merged version: a single horizontal segment spanning the union.
 *
 * Returns null when the segments are on different y-lines (not collinear).
 */
function mergeHorizontalSegments(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): [Point, Point] | null {
  if (Math.abs(a1.y - b1.y) > 1e-9) return null
  const y = a1.y
  const xMin = Math.min(a1.x, a2.x, b1.x, b2.x)
  const xMax = Math.max(a1.x, a2.x, b1.x, b2.x)
  return [
    { x: xMin, y },
    { x: xMax, y },
  ]
}

/**
 * Given two overlapping / adjacent same-net vertical segments, return the
 * merged version.
 *
 * Returns null when the segments are on different x-lines (not collinear).
 */
function mergeVerticalSegments(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): [Point, Point] | null {
  if (Math.abs(a1.x - b1.x) > 1e-9) return null
  const x = a1.x
  const yMin = Math.min(a1.y, a2.y, b1.y, b2.y)
  const yMax = Math.max(a1.y, a2.y, b1.y, b2.y)
  return [
    { x, y: yMin },
    { x, y: yMax },
  ]
}

/**
 * Extract all axis-aligned segments from a trace path as pairs of consecutive
 * points.
 */
function getSegments(tracePath: Point[]): Array<[Point, Point]> {
  const segments: Array<[Point, Point]> = []
  for (let i = 0; i < tracePath.length - 1; i++) {
    segments.push([tracePath[i]!, tracePath[i + 1]!])
  }
  return segments
}

/**
 * Attempts to merge two traces that share the same net by combining collinear
 * overlapping/adjacent segments.  Returns a new merged SolvedTracePath when a
 * merge is possible, otherwise returns null.
 *
 * The merge is "bridge-based": for each pair of axis-aligned segments (one from
 * each trace) that are collinear and whose projections overlap or are within
 * `threshold`, we build a new unified path that spans the union of both traces
 * via the merged segment.
 */
function tryMergeTraces(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  threshold: number,
): SolvedTracePath | null {
  const segsA = getSegments(traceA.tracePath)
  const segsB = getSegments(traceB.tracePath)

  for (const [a1, a2] of segsA) {
    for (const [b1, b2] of segsB) {
      const bothHoriz = isHorizontal(a1, a2) && isHorizontal(b1, b2)
      const bothVert = isVertical(a1, a2) && isVertical(b1, b2)

      if (!bothHoriz && !bothVert) continue

      // Check perpendicular distance (collinearity within threshold)
      const perpDist = bothHoriz
        ? Math.abs(a1.y - b1.y)
        : Math.abs(a1.x - b1.x)

      if (perpDist > threshold) continue

      // Check that 1-D projections overlap or are close
      const overlaps = bothHoriz
        ? intervals1DClose(a1.x, a2.x, b1.x, b2.x, threshold)
        : intervals1DClose(a1.y, a2.y, b1.y, b2.y, threshold)

      if (!overlaps) continue

      // Only merge when the segments are truly collinear (same axis line)
      const merged = bothHoriz
        ? mergeHorizontalSegments(a1, a2, b1, b2)
        : mergeVerticalSegments(a1, a2, b1, b2)

      if (!merged) continue

      const [mergedStart, mergedEnd] = merged

      // Build new unified path: take all points from traceA path, replace the
      // matched segment with the merged segment, then append any remaining
      // points from traceB that extend beyond the merged region.
      const pathA = traceA.tracePath
      const pathB = traceB.tracePath

      // Find insertion indices in pathA
      const idxA1 = pathA.findIndex(
        (p) => Math.abs(p.x - a1.x) < 1e-9 && Math.abs(p.y - a1.y) < 1e-9,
      )
      const idxA2 = pathA.findIndex(
        (p) => Math.abs(p.x - a2.x) < 1e-9 && Math.abs(p.y - a2.y) < 1e-9,
      )
      if (idxA1 === -1 || idxA2 === -1) continue

      const startIdx = Math.min(idxA1, idxA2)
      const endIdx = Math.max(idxA1, idxA2)

      // Replace segment in pathA with merged segment
      const newPath: Point[] = [
        ...pathA.slice(0, startIdx),
        mergedStart,
        mergedEnd,
        ...pathA.slice(endIdx + 1),
      ]

      // Absorb traceB tail/head that extends beyond merged region
      // Find the segment index within pathB
      const idxB1 = pathB.findIndex(
        (p) => Math.abs(p.x - b1.x) < 1e-9 && Math.abs(p.y - b1.y) < 1e-9,
      )
      const idxB2 = pathB.findIndex(
        (p) => Math.abs(p.x - b2.x) < 1e-9 && Math.abs(p.y - b2.y) < 1e-9,
      )
      if (idxB1 !== -1 && idxB2 !== -1) {
        const bStartIdx = Math.min(idxB1, idxB2)
        const bEndIdx = Math.max(idxB1, idxB2)

        // Prepend any leading points from pathB
        const bPrefix = pathB.slice(0, bStartIdx)
        // Append any trailing points from pathB
        const bSuffix = pathB.slice(bEndIdx + 1)

        // Only incorporate if they actually extend the path
        if (bPrefix.length > 0) {
          newPath.unshift(...bPrefix)
        }
        if (bSuffix.length > 0) {
          newPath.push(...bSuffix)
        }
      }

      // Deduplicate consecutive duplicate points
      const dedupedPath: Point[] = []
      for (const pt of newPath) {
        const last = dedupedPath[dedupedPath.length - 1]
        if (!last || Math.abs(last.x - pt.x) > 1e-9 || Math.abs(last.y - pt.y) > 1e-9) {
          dedupedPath.push(pt)
        }
      }

      // Build merged trace inheriting metadata from traceA, merging pin sets
      const mergedTrace: SolvedTracePath = {
        ...traceA,
        tracePath: dedupedPath,
        pinIds: Array.from(new Set([...traceA.pinIds, ...traceB.pinIds])),
        mspConnectionPairIds: Array.from(
          new Set([
            ...traceA.mspConnectionPairIds,
            ...traceB.mspConnectionPairIds,
          ]),
        ),
      }

      return mergedTrace
    }
  }

  return null
}

/**
 * SameNetSegmentMergeSolver
 *
 * A new pipeline phase that combines same-net trace segments that are close
 * together (collinear or nearly collinear) into a single merged trace.  This
 * reduces visual clutter by eliminating near-duplicate parallel wire runs on
 * the same net.
 *
 * The solver iterates over all pairs of traces that share the same net and
 * attempts to merge overlapping collinear segments.  It repeats until no more
 * merges are possible (fixed-point convergence).
 */
export class SameNetSegmentMergeSolver extends BaseSolver {
  private input: SameNetSegmentMergeSolverInput
  private mergeThreshold: number
  outputTraces: SolvedTracePath[]

  /** Pair indices still queued for comparison */
  private pairQueue: Array<[number, number]>
  private dirty = false

  constructor(input: SameNetSegmentMergeSolverInput) {
    super()
    this.input = input
    this.mergeThreshold = input.mergeThreshold ?? 0.15
    this.outputTraces = [...input.allTraces]
    this.pairQueue = this._buildPairQueue(this.outputTraces)
  }

  private _buildPairQueue(
    traces: SolvedTracePath[],
  ): Array<[number, number]> {
    const queue: Array<[number, number]> = []
    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        // Only pair up traces on the same net
        if (getNetId(traces[i]!) === getNetId(traces[j]!)) {
          queue.push([i, j])
        }
      }
    }
    return queue
  }

  override _step() {
    // If we drained the queue and found merges, rebuild for another pass
    if (this.pairQueue.length === 0) {
      if (this.dirty) {
        // Another convergence pass
        this.pairQueue = this._buildPairQueue(this.outputTraces)
        this.dirty = false
      } else {
        this.solved = true
      }
      return
    }

    const [i, j] = this.pairQueue.shift()!

    const traceA = this.outputTraces[i]
    const traceB = this.outputTraces[j]

    if (!traceA || !traceB) return

    // Skip if the net ids no longer match (traces may have been merged/removed)
    if (getNetId(traceA) !== getNetId(traceB)) return

    const merged = tryMergeTraces(traceA, traceB, this.mergeThreshold)
    if (merged) {
      // Replace traceA with merged result, remove traceB
      this.outputTraces[i] = merged
      this.outputTraces.splice(j, 1)

      // Re-index: any queued pair index >= j needs adjustment
      this.pairQueue = this.pairQueue
        .map(([a, b]) => {
          const newA = a >= j ? a - 1 : a
          const newB = b >= j ? b - 1 : b
          // Drop pairs referencing the removed index j (now gone)
          if (a === j || b === j) return null
          return [newA, newB] as [number, number]
        })
        .filter((pair): pair is [number, number] => pair !== null)

      this.dirty = true
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
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
