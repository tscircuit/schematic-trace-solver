import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

/**
 * Default threshold for considering two parallel segments as "close enough"
 * to merge. Segments within this distance on the perpendicular axis will be
 * aligned to their average coordinate.
 *
 * 0.15 works well for typical schematic grid spacing.
 */
const DEFAULT_MERGE_EPS = 0.15

/**
 * Minimum overlap required along the parallel axis for segments to be merge
 * candidates, as a fraction of the shorter segment's length.
 */
const MIN_OVERLAP_RATIO = 0.1

/**
 * A segment extracted from a trace path: either horizontal (same y) or
 * vertical (same x).
 */
interface Segment {
  /** The mspPairId of the trace this segment belongs to */
  traceId: string
  /** Start point index in the original tracePath */
  pointIndex: number
  /** Reference to the parent trace */
  traceRef: SolvedTracePath
  /** Whether this segment is horizontal */
  horizontal: boolean
  /** The constant coordinate: y for horizontal, x for vertical */
  coord: number
  /** Min/Max along the non-constant axis */
  lo: number
  hi: number
}

/**
 * Extract all horizontal and vertical segments from a trace path.
 */
function extractSegments(
  traceId: string,
  trace: SolvedTracePath,
): Segment[] {
  const segments: Segment[] = []
  const path = trace.tracePath

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]

    // Skip zero-length segments
    if (a.x === b.x && a.y === b.y) continue

    if (a.y === b.y) {
      // Horizontal segment
      segments.push({
        traceId,
        pointIndex: i,
        traceRef: trace,
        horizontal: true,
        coord: a.y,
        lo: Math.min(a.x, b.x),
        hi: Math.max(a.x, b.x),
      })
    } else if (a.x === b.x) {
      // Vertical segment
      segments.push({
        traceId,
        pointIndex: i,
        traceRef: trace,
        horizontal: false,
        coord: a.x,
        lo: Math.min(a.y, b.y),
        hi: Math.max(a.y, b.y),
      })
    }
  }

  return segments
}

/**
 * Check if a segment is a pin endpoint (first or last segment in the trace).
 * Endpoint segments connect to chip pins and should NOT be moved.
 */
function isEndpoint(segment: Segment): boolean {
  return segment.pointIndex === 0 ||
    segment.pointIndex >= segment.traceRef.tracePath.length - 2
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
 * Do two parallel segments overlap?
 * For horizontal: do their X ranges overlap? For vertical: do their Y ranges overlap?
 */
function rangesOverlap(a: Segment, b: Segment): boolean {
  const overlapStart = Math.max(a.lo, b.lo)
  const overlapEnd = Math.min(a.hi, b.hi)
  const overlapLen = overlapEnd - overlapStart
  if (overlapLen <= 0) return false

  const shorterLen = Math.min(a.hi - a.lo, b.hi - b.lo)
  if (shorterLen <= 0) return false

  return overlapLen / shorterLen >= MIN_OVERLAP_RATIO
}

/**
 * Get the separation distance between two parallel segments.
 * For horizontal: difference in Y. For vertical: difference in X.
 */
function separation(a: Segment, b: Segment): number {
  return Math.abs(a.coord - b.coord)
}

/**
 * Merge same-net traces by snapping parallel close segments to the same
 * coordinate.
 *
 * For each net, all segments from all traces in that net are collected.
 * Parallel segments that are:
 *   - close enough (separation < mergeEps)
 *   - overlapping sufficiently on the varying axis
 *   - from different traces
 *   - NOT pin endpoint segments
 * are snapped to their average coordinate.
 *
 * @param traces - The trace paths to process
 * @param mergeEps - Distance threshold (default: 0.15)
 */
export function mergeSameNetTraces(
  traces: SolvedTracePath[],
  mergeEps: number = DEFAULT_MERGE_EPS,
): SolvedTracePath[] {
  if (traces.length < 2) return traces

  const groups = groupByNet(traces)

  // Collect all changes: traceId -> which coordinates to update
  const coordsToUpdate = new Map<
    string,
    Map<number, number> // oldCoord -> newCoord for horizontal
  >()
  const coordsToUpdateV = new Map<
    string,
    Map<number, number> // oldCoord -> newCoord for vertical
  >()

  for (const [, sameNetTraces] of groups) {
    if (sameNetTraces.length < 2) continue

    // Collect all segments for this net
    const segments: Segment[] = []
    for (const trace of sameNetTraces) {
      for (const seg of extractSegments(trace.mspPairId, trace)) {
        segments.push(seg)
      }
    }

    // --- Clustering approach ---
    // Group segments by orientation (horizontal vs vertical)
    const horizSegs = segments.filter((s) => s.horizontal)
    const vertSegs = segments.filter((s) => !s.horizontal)

    processOrientation(horizSegs, mergeEps, coordsToUpdate)
    processOrientation(vertSegs, mergeEps, coordsToUpdateV)
  }

  // Apply all coordinate updates to traces
  return applyUpdates(traces, coordsToUpdate, coordsToUpdateV)
}

/**
 * Process all segments of one orientation, grouping close parallel segments
 * into clusters and recording the average coordinate for each cluster.
 */
function processOrientation(
  segments: Segment[],
  mergeEps: number,
  coordUpdates: Map<string, Map<number, number>>,
): void {
  if (segments.length < 2) return

  // Sort by constant coordinate for efficient grouping
  segments.sort((a, b) => a.coord - b.coord)

  const processed = new Set<number>()

  for (let i = 0; i < segments.length; i++) {
    if (processed.has(i)) continue

    // Skip endpoint segments -- they can't be anchors for clusters
    if (isEndpoint(segments[i])) continue

    const cluster: number[] = [i]

    for (let j = i + 1; j < segments.length; j++) {
      if (processed.has(j)) continue

      const si = segments[i]
      const sj = segments[j]

      // Must be from different traces
      if (si.traceId === sj.traceId) continue

      // Check distance
      if (separation(si, sj) > mergeEps) break // sorted, so all further will be farther

      // Check overlap
      if (!rangesOverlap(si, sj)) continue

      // Skip endpoint segments as cluster members too
      if (isEndpoint(sj)) continue

      cluster.push(j)
    }

    if (cluster.length < 2) continue

    // Compute average coordinate across the cluster
    let sum = 0
    for (const idx of cluster) {
      sum += segments[idx].coord
    }
    const avgCoord = sum / cluster.length

    // Apply to all cluster members
    for (const idx of cluster) {
      const seg = segments[idx]
      if (!coordUpdates.has(seg.traceId)) {
        coordUpdates.set(seg.traceId, new Map())
      }
      // Only update if the coordinate actually changes
      if (Math.abs(seg.coord - avgCoord) > 1e-9) {
        coordUpdates.get(seg.traceId)!.set(seg.coord, avgCoord)
      }
      processed.add(idx)
    }
  }
}

/**
 * Apply all recorded coordinate updates to the trace paths.
 */
function applyUpdates(
  traces: SolvedTracePath[],
  horizUpdates: Map<string, Map<number, number>>,
  vertUpdates: Map<string, Map<number, number>>,
): SolvedTracePath[] {
  return traces.map((trace) => {
    const hUpdates = horizUpdates.get(trace.mspPairId)
    const vUpdates = vertUpdates.get(trace.mspPairId)

    if ((!hUpdates || hUpdates.size === 0) &&
        (!vUpdates || vUpdates.size === 0)) {
      return trace
    }

    let newPath = trace.tracePath.map((p) => {
      let { x, y } = p

      if (hUpdates) {
        for (const [oldY, newY] of hUpdates) {
          if (Math.abs(y - oldY) < 1e-9) {
            y = newY
            break
          }
        }
      }

      if (vUpdates) {
        for (const [oldX, newX] of vUpdates) {
          if (Math.abs(x - oldX) < 1e-9) {
            x = newX
            break
          }
        }
      }

      return { x, y }
    })

    // Simplify to remove collinear points introduced by snapping
    newPath = simplifyPath(newPath)

    return { ...trace, tracePath: newPath }
  })
}
