import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface Segment {
  traceIndex: number
  segIndex: number
  p1: Point
  p2: Point
}

/**
 * Merges same-net trace lines that are close together by snapping them
 * to the same Y (for horizontal segments) or the same X (for vertical
 * segments). This produces cleaner schematics where traces belonging to
 * the same net align rather than running as separate parallel lines with
 * a tiny offset.
 *
 * @param threshold - Maximum distance between two parallel same-net
 *   segments for them to be considered "close" and merged.
 */
export const mergeSameNetCloseTraces = (
  allTraces: SolvedTracePath[],
  threshold = 0.3,
): SolvedTracePath[] => {
  const EPS = 1e-9

  // Group traces by globalConnNetId
  const netGroups: Record<string, number[]> = {}
  for (let i = 0; i < allTraces.length; i++) {
    const netId = allTraces[i].globalConnNetId
    if (!netGroups[netId]) netGroups[netId] = []
    netGroups[netId].push(i)
  }

  // Clone all trace paths so we can mutate them
  const result: SolvedTracePath[] = allTraces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ x: p.x, y: p.y })),
  }))

  for (const netId in netGroups) {
    const traceIndices = netGroups[netId]
    if (traceIndices.length < 2) continue

    // Collect all horizontal and vertical segments for this net
    const horizontalSegments: Segment[] = []
    const verticalSegments: Segment[] = []

    for (const traceIdx of traceIndices) {
      const path = result[traceIdx].tracePath
      for (let s = 0; s < path.length - 1; s++) {
        const p1 = path[s]
        const p2 = path[s + 1]
        const isHorz = Math.abs(p1.y - p2.y) < EPS
        const isVert = Math.abs(p1.x - p2.x) < EPS

        // Skip endpoint segments (first and last) to preserve pin connectivity
        const isEndpointSegment = s === 0 || s === path.length - 2
        if (isEndpointSegment) continue

        if (isHorz) {
          horizontalSegments.push({ traceIndex: traceIdx, segIndex: s, p1, p2 })
        } else if (isVert) {
          verticalSegments.push({ traceIndex: traceIdx, segIndex: s, p1, p2 })
        }
      }
    }

    // Merge horizontal segments that are close in Y and overlap in X
    mergeParallelSegments(horizontalSegments, "horizontal", threshold, result)

    // Merge vertical segments that are close in X and overlap in Y
    mergeParallelSegments(verticalSegments, "vertical", threshold, result)
  }

  return result
}

function mergeParallelSegments(
  segments: Segment[],
  direction: "horizontal" | "vertical",
  threshold: number,
  allTraces: SolvedTracePath[],
) {
  const EPS = 1e-9

  // Group segments by their perpendicular coordinate (Y for horizontal, X for vertical)
  // using a clustering approach based on threshold
  if (segments.length < 2) return

  // Sort by the perpendicular coordinate
  const sorted = [...segments].sort((a, b) => {
    if (direction === "horizontal") {
      return a.p1.y - b.p1.y
    }
    return a.p1.x - b.p1.x
  })

  // Cluster segments that are within threshold of each other on the perpendicular axis
  const clusters: Segment[][] = []
  let currentCluster: Segment[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentCluster[0]
    const curr = sorted[i]

    const prevCoord = direction === "horizontal" ? prev.p1.y : prev.p1.x
    const currCoord = direction === "horizontal" ? curr.p1.y : curr.p1.x

    if (Math.abs(currCoord - prevCoord) <= threshold) {
      currentCluster.push(curr)
    } else {
      if (currentCluster.length > 1) {
        clusters.push(currentCluster)
      }
      currentCluster = [curr]
    }
  }
  if (currentCluster.length > 1) {
    clusters.push(currentCluster)
  }

  // For each cluster, check which segments actually overlap on the parallel axis
  // and snap them to the average perpendicular coordinate
  for (const cluster of clusters) {
    // Only merge segments from different traces
    const uniqueTraces = new Set(cluster.map((s) => s.traceIndex))
    if (uniqueTraces.size < 2) continue

    // Find groups of segments that overlap on the parallel axis
    const overlapGroups = findOverlappingGroups(cluster, direction, EPS)

    for (const group of overlapGroups) {
      // Only process groups with segments from multiple traces
      const groupTraces = new Set(group.map((s) => s.traceIndex))
      if (groupTraces.size < 2) continue

      // Compute average perpendicular coordinate
      let avgCoord = 0
      for (const seg of group) {
        avgCoord += direction === "horizontal" ? seg.p1.y : seg.p1.x
      }
      avgCoord /= group.length

      // Snap all segments in this group to the average coordinate
      for (const seg of group) {
        const path = allTraces[seg.traceIndex].tracePath
        if (direction === "horizontal") {
          path[seg.segIndex].y = avgCoord
          path[seg.segIndex + 1].y = avgCoord
        } else {
          path[seg.segIndex].x = avgCoord
          path[seg.segIndex + 1].x = avgCoord
        }
      }
    }
  }
}

/**
 * Given a set of parallel segments in the same cluster (close perpendicular
 * coord), find subsets that overlap on the parallel axis.
 */
function findOverlappingGroups(
  segments: Segment[],
  direction: "horizontal" | "vertical",
  eps: number,
): Segment[][] {
  // For horizontal segments, parallel axis is X; for vertical, it's Y
  const getRange = (seg: Segment): [number, number] => {
    if (direction === "horizontal") {
      return [Math.min(seg.p1.x, seg.p2.x), Math.max(seg.p1.x, seg.p2.x)]
    }
    return [Math.min(seg.p1.y, seg.p2.y), Math.max(seg.p1.y, seg.p2.y)]
  }

  const overlaps = (a: [number, number], b: [number, number]): boolean => {
    const overlap = Math.min(a[1], b[1]) - Math.max(a[0], b[0])
    return overlap > eps
  }

  // Use union-find to group overlapping segments
  const parent: number[] = segments.map((_, i) => i)

  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }

  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      // Only merge segments from different traces
      if (segments[i].traceIndex === segments[j].traceIndex) continue
      const rangeI = getRange(segments[i])
      const rangeJ = getRange(segments[j])
      if (overlaps(rangeI, rangeJ)) {
        union(i, j)
      }
    }
  }

  // Group by root
  const groups: Record<number, Segment[]> = {}
  for (let i = 0; i < segments.length; i++) {
    const root = find(i)
    if (!groups[root]) groups[root] = []
    groups[root].push(segments[i])
  }

  return Object.values(groups).filter((g) => g.length > 1)
}
