import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"

/**
 * Threshold (in schematic units) within which two parallel same-net segments
 * are considered "too close" and should be merged into a single segment.
 */
const MERGE_THRESHOLD = 0.1

/**
 * Minimum fractional overlap (0–1) along the shared axis that two segments
 * must have before they are eligible for merging.
 */
const MIN_OVERLAP_FRACTION = 0.5

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
}

type Point = { x: number; y: number }

/**
 * Extract axis-aligned segments from a trace path.
 * Returns a list of { x1, y1, x2, y2 } objects where each segment is
 * strictly horizontal (same y) or strictly vertical (same x).
 */
function extractSegments(
  path: Point[],
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> =
    []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  }
  return segments
}

/**
 * Compute the fractional overlap between two 1-D intervals [a1,a2] and [b1,b2].
 * Returns a value in [0, 1] relative to the shorter interval.
 */
function overlapFraction(a1: number, a2: number, b1: number, b2: number) {
  const lo1 = Math.min(a1, a2)
  const hi1 = Math.max(a1, a2)
  const lo2 = Math.min(b1, b2)
  const hi2 = Math.max(b1, b2)

  const overlapLen = Math.max(0, Math.min(hi1, hi2) - Math.max(lo1, lo2))
  const shorter = Math.min(hi1 - lo1, hi2 - lo2)
  if (shorter === 0) return 0
  return overlapLen / shorter
}

/**
 * SameNetTraceMergeSolver runs after the main routing pipeline and collapses
 * pairs of schematic trace segments that:
 *   - belong to the same net (same globalConnNetId / userNetId)
 *   - are both horizontal or both vertical
 *   - are within MERGE_THRESHOLD of each other on the perpendicular axis
 *   - overlap by at least MIN_OVERLAP_FRACTION along the shared axis
 *
 * Merged segments are snapped to the midpoint of the two perpendicular
 * positions and their shared-axis ranges are unioned.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  private outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))
  }

  override _step() {
    this.outputTraces = this._mergeCloseSegments(this.outputTraces)
    this.solved = true
  }

  /**
   * Core merge logic. Iterates until no more merges are possible.
   */
  private _mergeCloseSegments(traces: SolvedTracePath[]): SolvedTracePath[] {
    let changed = true
    let current = traces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))

    while (changed) {
      changed = false

      // Group trace indices by net identifier
      const byNet = new Map<string, number[]>()
      for (let i = 0; i < current.length; i++) {
        const netId =
          current[i].userNetId ??
          current[i].globalConnNetId ??
          current[i].dcConnNetId
        if (!byNet.has(netId)) byNet.set(netId, [])
        byNet.get(netId)!.push(i)
      }

      outer: for (const [, indices] of byNet) {
        if (indices.length < 2) continue

        // Compare all pairs of traces in this net
        for (let ai = 0; ai < indices.length; ai++) {
          for (let bi = ai + 1; bi < indices.length; bi++) {
            const traceA = current[indices[ai]]
            const traceB = current[indices[bi]]

            const mergedPath = this._tryMergePaths(
              traceA.tracePath,
              traceB.tracePath,
            )
            if (mergedPath) {
              // Replace traceA with the merged trace, remove traceB
              current[indices[ai]] = {
                ...traceA,
                tracePath: mergedPath,
              }
              current.splice(indices[bi], 1)
              changed = true
              break outer
            }
          }
        }
      }
    }

    return current
  }

  /**
   * Try to find a single pair of parallel close segments between pathA and
   * pathB and produce a merged path. Returns null if no merge is possible.
   *
   * Strategy: for each segment in pathA and each segment in pathB, check
   * whether they are parallel and close. If yes, merge both full paths by
   * replacing each matching segment with the averaged position.
   */
  private _tryMergePaths(
    pathA: Point[],
    pathB: Point[],
  ): Point[] | null {
    const segsA = extractSegments(pathA)
    const segsB = extractSegments(pathB)

    for (let ia = 0; ia < segsA.length; ia++) {
      const sa = segsA[ia]
      const isHorizA = Math.abs(sa.y1 - sa.y2) < 1e-9
      const isVertA = Math.abs(sa.x1 - sa.x2) < 1e-9
      if (!isHorizA && !isVertA) continue // diagonal, skip

      for (let ib = 0; ib < segsB.length; ib++) {
        const sb = segsB[ib]
        const isHorizB = Math.abs(sb.y1 - sb.y2) < 1e-9
        const isVertB = Math.abs(sb.x1 - sb.x2) < 1e-9
        if (!isHorizB && !isVertB) continue

        // Must be same orientation
        if (isHorizA !== isHorizB) continue

        if (isHorizA) {
          // Horizontal segments: same y within threshold, overlapping x ranges
          const dy = Math.abs(sa.y1 - sb.y1)
          if (dy > MERGE_THRESHOLD) continue

          const frac = overlapFraction(sa.x1, sa.x2, sb.x1, sb.x2)
          if (frac < MIN_OVERLAP_FRACTION) continue

          // Merge: midpoint y, union x range
          const midY = (sa.y1 + sb.y1) / 2
          const newX1 = Math.min(
            Math.min(sa.x1, sa.x2),
            Math.min(sb.x1, sb.x2),
          )
          const newX2 = Math.max(
            Math.max(sa.x1, sa.x2),
            Math.max(sb.x1, sb.x2),
          )

          return this._buildMergedPath(
            pathA, pathB,
            ia, ib,
            { x: newX1, y: midY }, { x: newX2, y: midY },
          )
        } else {
          // Vertical segments: same x within threshold, overlapping y ranges
          const dx = Math.abs(sa.x1 - sb.x1)
          if (dx > MERGE_THRESHOLD) continue

          const frac = overlapFraction(sa.y1, sa.y2, sb.y1, sb.y2)
          if (frac < MIN_OVERLAP_FRACTION) continue

          // Merge: midpoint x, union y range
          const midX = (sa.x1 + sb.x1) / 2
          const newY1 = Math.min(
            Math.min(sa.y1, sa.y2),
            Math.min(sb.y1, sb.y2),
          )
          const newY2 = Math.max(
            Math.max(sa.y1, sa.y2),
            Math.max(sb.y1, sb.y2),
          )

          return this._buildMergedPath(
            pathA, pathB,
            ia, ib,
            { x: midX, y: newY1 }, { x: midX, y: newY2 },
          )
        }
      }
    }

    return null
  }

  /**
   * Build a merged path by grafting the merged segment back into pathA
   * (replacing segment ia) and discarding pathB entirely.
   */
  private _buildMergedPath(
    pathA: Point[],
    _pathB: Point[],
    segIndexA: number,
    _segIndexB: number,
    newStart: Point,
    newEnd: Point,
  ): Point[] {
    // Replace the segment [segIndexA] in pathA with [newStart, newEnd].
    // Points before segIndexA stay, points after segIndexA+1 stay.
    const before = pathA.slice(0, segIndexA)
    const after = pathA.slice(segIndexA + 2)

    // Determine direction consistency: if pathA point at segIndexA
    // was "closer" to newStart or newEnd
    const origStart = pathA[segIndexA]
    const distToNew1 =
      Math.hypot(origStart.x - newStart.x, origStart.y - newStart.y)
    const distToNew2 =
      Math.hypot(origStart.x - newEnd.x, origStart.y - newEnd.y)

    const orderedStart = distToNew1 <= distToNew2 ? newStart : newEnd
    const orderedEnd = distToNew1 <= distToNew2 ? newEnd : newStart

    return [...before, orderedStart, orderedEnd, ...after]
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
// same-net merge solver
