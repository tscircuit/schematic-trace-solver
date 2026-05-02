import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

/**
 * Aligns segments of the same net that are close together.
 * For example, if two horizontal segments of the same net have Y coordinates
 * within a threshold, they are moved to the same Y level.
 */
export const alignSameNetTraces = ({
  traces,
  threshold = 0.25,
}: {
  traces: SolvedTracePath[]
  threshold?: number
}): SolvedTracePath[] => {
  const updatedTraces = [...traces]
  const netGroups = new Map<string, number[]>()

  // Group traces by globalConnNetId
  for (let i = 0; i < updatedTraces.length; i++) {
    const netId = updatedTraces[i].globalConnNetId
    if (!netGroups.has(netId)) {
      netGroups.set(netId, [])
    }
    netGroups.get(netId)!.push(i)
  }

  for (const [netId, traceIndices] of netGroups.entries()) {
    if (traceIndices.length <= 1) continue

    // Align horizontal segments
    alignSegments(updatedTraces, traceIndices, "y", "x", threshold)
    // Align vertical segments
    alignSegments(updatedTraces, traceIndices, "x", "y", threshold)
  }

  return updatedTraces
}

function alignSegments(
  traces: SolvedTracePath[],
  indices: number[],
  coord: "x" | "y",
  otherCoord: "x" | "y",
  threshold: number,
) {
  const segments: { traceIdx: number; pointIdx: number; val: number; start: number; end: number }[] = []

  for (const idx of indices) {
    const path = traces[idx].tracePath
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]
      if (Math.abs(p1[coord] - p2[coord]) < 0.0001) {
        // This is a segment orthogonal to 'coord' (e.g. if coord is 'y', this is a horizontal segment)
        // Wait, if coord is 'y', p1.y == p2.y means it's horizontal.
        segments.push({
          traceIdx: idx,
          pointIdx: i,
          val: p1[coord],
          start: Math.min(p1[otherCoord], p2[otherCoord]),
          end: Math.max(p1[otherCoord], p2[otherCoord]),
        })
      }
    }
  }

  if (segments.length <= 1) return

  // Simple clustering: sort by val and group
  segments.sort((a, b) => a.val - b.val)

  const clusters: typeof segments[] = []
  if (segments.length > 0) {
    let currentCluster = [segments[0]]
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].val - segments[i - 1].val < threshold) {
        currentCluster.push(segments[i])
      } else {
        clusters.push(currentCluster)
        currentCluster = [segments[i]]
      }
    }
    clusters.push(currentCluster)
  }

  for (const cluster of clusters) {
    if (cluster.length <= 1) continue

    // Find the best value for this cluster (e.g., the average)
    // Actually, let's use the first one's value or the median to keep it stable
    const targetVal = cluster[0].val

    for (const seg of cluster) {
      const path = traces[seg.traceIdx].tracePath
      
      // Only align if it's an internal segment (not connected to pins)
      // This ensures we don't create slanted lines near pins.
      if (seg.pointIdx > 0 && seg.pointIdx + 1 < path.length - 1) {
        path[seg.pointIdx][coord] = targetVal
        path[seg.pointIdx + 1][coord] = targetVal
      }
    }
  }
}
