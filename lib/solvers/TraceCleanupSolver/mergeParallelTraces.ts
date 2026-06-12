import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface TraceSegment {
  traceId: string
  segmentIndex: number
  isHorizontal: boolean
  coordinate: number // Y for horizontal, X for vertical
  start: { x: number; y: number }
  end: { x: number; y: number }
}

/**
 * Extracts all axis-aligned segments from traces.
 * Returns segments with their trace ID, segment index, and coordinate info.
 */
function extractSegments(traces: SolvedTracePath[]): TraceSegment[] {
  const segments: TraceSegment[] = []

  for (const trace of traces) {
    const path = trace.tracePath
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]!
      const p2 = path[i + 1]!

      // Skip diagonal segments
      if (p1.x !== p2.x && p1.y !== p2.y) continue

      const isHorizontal = p1.y === p2.y
      segments.push({
        traceId: trace.mspPairId,
        segmentIndex: i,
        isHorizontal,
        coordinate: isHorizontal ? p1.y : p1.x,
        start: { x: p1.x, y: p1.y },
        end: { x: p2.x, y: p2.y },
      })
    }
  }

  return segments
}

/**
 * Clusters segments by their coordinate (Y for horizontal, X for vertical)
 * within a tolerance threshold.
 */
function clusterByCoordinate(
  segments: TraceSegment[],
  tolerance: number,
): TraceSegment[][] {
  if (segments.length === 0) return []

  // Sort by coordinate
  const sorted = [...segments].sort((a, b) => a.coordinate - b.coordinate)

  const clusters: TraceSegment[][] = []
  let currentCluster: TraceSegment[] = [sorted[0]!]

  for (let i = 1; i < sorted.length; i++) {
    const segment = sorted[i]!
    const lastSegment = currentCluster[currentCluster.length - 1]!

    if (Math.abs(segment.coordinate - lastSegment.coordinate) <= tolerance) {
      currentCluster.push(segment)
    } else {
      clusters.push(currentCluster)
      currentCluster = [segment]
    }
  }
  clusters.push(currentCluster)

  return clusters.filter((c) => c.length > 1)
}

/**
 * Calculates the median of a number array.
 */
function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

/**
 * Snaps all segments in a cluster to the target coordinate.
 */
function snapSegmentsToCoordinate(
  segments: TraceSegment[],
  targetCoordinate: number,
  traces: Map<string, SolvedTracePath>,
): void {
  for (const segment of segments) {
    const trace = traces.get(segment.traceId)
    if (!trace) continue

    const path = trace.tracePath

    // Update the segment's points to the target coordinate
    if (segment.isHorizontal) {
      // Horizontal segment: snap Y coordinate
      // Update start point
      if (segment.segmentIndex < path.length) {
        path[segment.segmentIndex] = {
          ...path[segment.segmentIndex]!,
          y: targetCoordinate,
        }
      }
      // Update end point
      if (segment.segmentIndex + 1 < path.length) {
        path[segment.segmentIndex + 1] = {
          ...path[segment.segmentIndex + 1]!,
          y: targetCoordinate,
        }
      }
    } else {
      // Vertical segment: snap X coordinate
      if (segment.segmentIndex < path.length) {
        path[segment.segmentIndex] = {
          ...path[segment.segmentIndex]!,
          x: targetCoordinate,
        }
      }
      if (segment.segmentIndex + 1 < path.length) {
        path[segment.segmentIndex + 1] = {
          ...path[segment.segmentIndex + 1]!,
          x: targetCoordinate,
        }
      }
    }
  }
}

/**
 * Merges parallel trace segments that are on the same net and within tolerance.
 * This aligns horizontal segments to the same Y and vertical segments to the same X.
 */
export function mergeParallelTraces(
  traces: SolvedTracePath[],
  netIdMap: Map<string, string>, // traceId -> netId
  tolerance: number = 2,
): SolvedTracePath[] {
  const tracesMap = new Map(traces.map((t) => [t.mspPairId, t]))

  // Group traces by netId
  const tracesByNet = new Map<string, SolvedTracePath[]>()

  for (const trace of traces) {
    const netId = netIdMap.get(trace.mspPairId)
    if (!netId) continue

    const existing = tracesByNet.get(netId) || []
    existing.push(trace)
    tracesByNet.set(netId, existing)
  }

  // Process each net's traces
  for (const [, netTraces] of tracesByNet) {
    if (netTraces.length < 2) continue

    const segments = extractSegments(netTraces)

    // Separate horizontal and vertical segments
    const horizontalSegments = segments.filter((s) => s.isHorizontal)
    const verticalSegments = segments.filter((s) => !s.isHorizontal)

    // Cluster and snap
    const hClusters = clusterByCoordinate(horizontalSegments, tolerance)
    const vClusters = clusterByCoordinate(verticalSegments, tolerance)

    for (const cluster of [...hClusters, ...vClusters]) {
      const coords = cluster.map((s) => s.coordinate)
      const targetCoord = median(coords)
      snapSegmentsToCoordinate(cluster, targetCoord, tracesMap)
    }
  }

  return Array.from(tracesMap.values())
}