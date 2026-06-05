import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

/**
 * EPS is the threshold for considering two parallel segments as "close enough"
 * to merge. If two horizontal segments differ in Y by less than this, they
 * snap to the mean Y. Same for vertical segments and X.
 */
const MERGE_EPS = 2e-3

/**
 * A segment from a trace: either horizontal (same y) or vertical (same x).
 */
interface Segment {
  /** The mspPairId of the trace this segment belongs to */
  traceId: string
  /** Start point */
  a: Point
  /** End point */
  b: Point
  /** Whether this segment is horizontal */
  horizontal: boolean
  /** The constant coordinate: y for horizontal, x for vertical */
  coord: number
  /** Min/Max along the non-constant axis */
  lo: number
  hi: number
}

/**
 * Given one trace's tracePath, extract all horizontal and vertical segments.
 */
function extractSegments(traceId: string, path: Point[]): Segment[] {
  const segments: Segment[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (a.y === b.y && a.x !== b.x) {
      // Horizontal segment
      segments.push({
        traceId,
        a,
        b,
        horizontal: true,
        coord: a.y,
        lo: Math.min(a.x, b.x),
        hi: Math.max(a.x, b.x),
      })
    } else if (a.x === b.x && a.y !== b.y) {
      // Vertical segment
      segments.push({
        traceId,
        a,
        b,
        horizontal: false,
        coord: a.x,
        lo: Math.min(a.y, b.y),
        hi: Math.max(a.y, b.y),
      })
    }
    // Skip zero-length segments
  }
  return segments
}

/**
 * Build a map from globalConnNetId -> array of traces.
 */
function groupByNet(traces: SolvedTracePath[]): Map<string, SolvedTracePath[]> {
  const groups = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!groups.has(netId)) {
      groups.set(netId, [])
    }
    groups.get(netId)!.push(trace)
  }
  return groups
}

/**
 * Are two segments parallel (both horizontal or both vertical)?
 */
function areParallel(a: Segment, b: Segment): boolean {
  return a.horizontal === b.horizontal
}

/**
 * Get the separation distance between two parallel segments.
 * For horizontal: difference in Y. For vertical: difference in X.
 */
function separation(a: Segment, b: Segment): number {
  return Math.abs(a.coord - b.coord)
}

/**
 * Do two parallel segments overlap or touch in their projected range?
 */
function rangesOverlap(a: Segment, b: Segment): boolean {
  return a.lo <= b.hi && b.lo <= a.hi
}

/**
 * Merge same-net traces by snapping parallel close segments to the same coordinate.
 *
 * For each net, we collect all segments from all traces in that net.
 * For each pair of parallel segments that are:
 *   - close enough (separation < MERGE_EPS)
 *   - overlapping or nearly overlapping in range
 * We snap both to a common coordinate.
 */
export function mergeSameNetTraces(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  const groups = groupByNet(traces)

  // Collect all changes: traceId -> list of modifications
  const tracePathDeltas = new Map<
    string,
    Array<{ isHorizontal: boolean; oldCoord: number; newCoord: number }>
  >()

  for (const [, sameNetTraces] of groups) {
    if (sameNetTraces.length < 2) continue

    // Collect all segments for this net
    const segments: Segment[] = []
    for (const trace of sameNetTraces) {
      for (const seg of extractSegments(trace.mspPairId, trace.tracePath)) {
        segments.push(seg)
      }
    }

    // Check each pair of segments
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]
        const b = segments[j]

        if (!areParallel(a, b)) continue
        if (a.traceId === b.traceId) continue // skip segments on same trace
        if (!rangesOverlap(a, b)) continue

        const sep = separation(a, b)
        if (sep >= MERGE_EPS) continue

        // Snap to mean coordinate
        const newCoord = (a.coord + b.coord) / 2

        // Record the change for each affected trace
        const recordDelta = (
          traceId: string,
          isHorizontal: boolean,
          oldCoord: number,
        ) => {
          if (!tracePathDeltas.has(traceId)) {
            tracePathDeltas.set(traceId, [])
          }
          tracePathDeltas.get(traceId)!.push({ isHorizontal, oldCoord, newCoord })
        }

        recordDelta(a.traceId, a.horizontal, a.coord)
        recordDelta(b.traceId, b.horizontal, b.coord)
      }
    }
  }

  // Apply deltas to traces
  const result = traces.map((trace) => {
    const deltas = tracePathDeltas.get(trace.mspPairId)
    if (!deltas || deltas.length === 0) return trace

    // Build a set of coordinate updates
    // Snapping parallel segments may affect multiple segments on same trace
    let newPath = [...trace.tracePath]

    for (const delta of deltas) {
      newPath = newPath.map((p) => {
        const threshold = 1e-9
        if (delta.isHorizontal) {
          // Snap Y if this point has the old Y
          if (Math.abs(p.y - delta.oldCoord) < threshold) {
            return { ...p, y: delta.newCoord }
          }
        } else {
          // Snap X if this point has the old X
          if (Math.abs(p.x - delta.oldCoord) < threshold) {
            return { ...p, x: delta.newCoord }
          }
        }
        return p
      })
    }

    // Simplify to remove collinear points
    newPath = simplifyPath(newPath)

    return { ...trace, tracePath: newPath }
  })

  return result
}
