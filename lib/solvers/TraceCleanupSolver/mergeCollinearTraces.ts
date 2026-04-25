import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Threshold for considering two parallel trace segments as "close enough" to merge.
 * Segments within this distance on the perpendicular axis will be aligned.
 */
const MERGE_THRESHOLD = 0.15

/**
 * Minimum overlap required along the parallel axis for segments to be merge candidates.
 */
const MIN_OVERLAP = 0.01

interface Segment {
  orientation: "horizontal" | "vertical"
  /** Fixed coordinate (y for horizontal, x for vertical) */
  fixed: number
  /** Start of the range along the varying axis */
  start: number
  /** End of the range along the varying axis */
  end: number
  /** Index of this segment's first point in the parent trace's tracePath */
  pointIndex: number
  /** Reference to the parent trace */
  traceRef: SolvedTracePath
}

function extractSegments(trace: SolvedTracePath): Segment[] {
  const segments: Segment[] = []
  const path = trace.tracePath

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!

    const dx = Math.abs(p1.x - p2.x)
    const dy = Math.abs(p1.y - p2.y)

    if (dy < 1e-6 && dx > 1e-6) {
      // Horizontal segment
      segments.push({
        orientation: "horizontal",
        fixed: p1.y,
        start: Math.min(p1.x, p2.x),
        end: Math.max(p1.x, p2.x),
        pointIndex: i,
        traceRef: trace,
      })
    } else if (dx < 1e-6 && dy > 1e-6) {
      // Vertical segment
      segments.push({
        orientation: "vertical",
        fixed: p1.x,
        start: Math.min(p1.y, p2.y),
        end: Math.max(p1.y, p2.y),
        pointIndex: i,
        traceRef: trace,
      })
    }
  }

  return segments
}

/**
 * Check if two ranges [s1, e1] and [s2, e2] overlap by at least MIN_OVERLAP.
 */
function rangesOverlap(
  s1: number,
  e1: number,
  s2: number,
  e2: number,
): boolean {
  const overlapStart = Math.max(s1, s2)
  const overlapEnd = Math.min(e1, e2)
  return overlapEnd - overlapStart > MIN_OVERLAP
}

/**
 * Check if a point is a pin endpoint (first or last point in the trace path).
 * Endpoints should not be moved as they connect to chip pins.
 */
function isEndpoint(pointIndex: number, tracePathLength: number): boolean {
  return pointIndex === 0 || pointIndex >= tracePathLength - 2
}

/**
 * Merges collinear same-net trace segments that run parallel and close together.
 *
 * When two traces belong to the same net (same globalConnNetId) and have
 * parallel segments within MERGE_THRESHOLD distance, this function aligns
 * them to the average coordinate, producing cleaner schematics.
 *
 * Only non-endpoint segments are adjusted to preserve pin connections.
 */
export function mergeCollinearTraces(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  // Group traces by globalConnNetId
  const tracesByNet: Record<string, SolvedTracePath[]> = {}
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!tracesByNet[netId]) {
      tracesByNet[netId] = []
    }
    tracesByNet[netId].push(trace)
  }

  // Process each net group
  for (const netId of Object.keys(tracesByNet)) {
    const netTraces = tracesByNet[netId]!
    if (netTraces.length < 2) continue

    // Extract all segments from all traces in this net
    const allSegments: Segment[] = []
    for (const trace of netTraces) {
      allSegments.push(...extractSegments(trace))
    }

    // Group segments by orientation
    const horizontalSegments = allSegments.filter(
      (s) => s.orientation === "horizontal",
    )
    const verticalSegments = allSegments.filter(
      (s) => s.orientation === "vertical",
    )

    // Align close horizontal segments
    alignCloseSegments(horizontalSegments)

    // Align close vertical segments
    alignCloseSegments(verticalSegments)
  }

  return traces
}

/**
 * Find groups of segments that are close together on the fixed axis and
 * have overlapping ranges, then align them to their average coordinate.
 */
function alignCloseSegments(segments: Segment[]): void {
  if (segments.length < 2) return

  // Sort by fixed coordinate for efficient grouping
  segments.sort((a, b) => a.fixed - b.fixed)

  const aligned = new Set<number>()

  for (let i = 0; i < segments.length; i++) {
    if (aligned.has(i)) continue

    const cluster: number[] = [i]

    for (let j = i + 1; j < segments.length; j++) {
      if (aligned.has(j)) continue

      const si = segments[i]!
      const sj = segments[j]!

      // Must be from different traces to be worth merging
      if (si.traceRef === sj.traceRef) continue

      // Check if close enough on the fixed axis
      if (Math.abs(si.fixed - sj.fixed) > MERGE_THRESHOLD) break

      // Check if they overlap on the varying axis
      if (rangesOverlap(si.start, si.end, sj.start, sj.end)) {
        cluster.push(j)
      }
    }

    if (cluster.length < 2) continue

    // Filter out endpoint segments -- we don't move those
    const movableIndices = cluster.filter((idx) => {
      const seg = segments[idx]!
      return !isEndpoint(seg.pointIndex, seg.traceRef.tracePath.length)
    })

    if (movableIndices.length < 1) continue

    // Compute average fixed coordinate across all cluster members
    let sum = 0
    for (const idx of cluster) {
      sum += segments[idx]!.fixed
    }
    const avgFixed = sum / cluster.length

    // Apply the alignment to movable segments
    for (const idx of movableIndices) {
      const seg = segments[idx]!
      const path = seg.traceRef.tracePath
      const p1 = path[seg.pointIndex]!
      const p2 = path[seg.pointIndex + 1]!

      if (seg.orientation === "horizontal") {
        p1.y = avgFixed
        p2.y = avgFixed
      } else {
        p1.x = avgFixed
        p2.x = avgFixed
      }

      seg.fixed = avgFixed
      aligned.add(idx)
    }

    // Mark all cluster members as processed
    for (const idx of cluster) {
      aligned.add(idx)
    }
  }
}
