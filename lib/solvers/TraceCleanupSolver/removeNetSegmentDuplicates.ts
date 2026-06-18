import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-9

const isSamePoint = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

/**
 * Returns a canonical key for a segment (direction-independent).
 * Two segments that are the same but in opposite directions produce the same key.
 */
const segmentKey = (a: Point, b: Point): string => {
  const p1 = `${a.x},${a.y}`
  const p2 = `${b.x},${b.y}`
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`
}

/**
 * Removes duplicate segments that appear in multiple traces of the same net.
 *
 * When the MSP solver creates trace paths for individual pin pairs, two traces
 * in the same net can route through the same physical segment (especially near
 * shared pin endpoints). This creates "extra trace lines" when rendered.
 *
 * This function keeps each unique segment exactly once per net by removing it
 * from any trace where it appears as a redundant endpoint segment (first or
 * last segment), while the same segment also exists in another trace of the
 * same net.
 *
 * Endpoint segments (leading to pin positions) are candidates for removal when
 * the same segment already exists in another trace, because the net remains
 * visually connected through the other trace's segment.
 */
export const removeNetSegmentDuplicates = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  // Group traces by net
  const byNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!byNet.has(netId)) byNet.set(netId, [])
    byNet.get(netId)!.push(trace)
  }

  const result: SolvedTracePath[] = []

  for (const [_netId, netTraces] of byNet) {
    if (netTraces.length < 2) {
      result.push(...netTraces)
      continue
    }

    // Count how many times each segment appears across all traces in this net
    const segCounts = new Map<string, number>()
    for (const trace of netTraces) {
      const seen = new Set<string>()
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const key = segmentKey(trace.tracePath[i], trace.tracePath[i + 1])
        // Only count each segment once per trace (avoid inflating from within-trace dups)
        if (!seen.has(key)) {
          seen.add(key)
          segCounts.set(key, (segCounts.get(key) ?? 0) + 1)
        }
      }
    }

    // Find segments that appear in multiple traces
    const duplicateSegs = new Set<string>()
    for (const [key, count] of segCounts) {
      if (count > 1) duplicateSegs.add(key)
    }

    if (duplicateSegs.size === 0) {
      result.push(...netTraces)
      continue
    }

    // For each trace, remove duplicate endpoint segments (first or last segment
    // only, to preserve interior routing integrity). The first occurrence of a
    // segment across traces is kept; subsequent traces that start/end with the
    // same segment have those endpoints trimmed.
    const alreadyClaimedSegs = new Set<string>()

    for (const trace of netTraces) {
      let { tracePath } = trace

      // Check if first segment is a duplicate — trim it from this trace
      // (only if the path has more than 2 points, so trimming leaves a valid path)
      let trimmedFront = false
      if (tracePath.length > 2) {
        const firstKey = segmentKey(tracePath[0], tracePath[1])
        if (duplicateSegs.has(firstKey) && alreadyClaimedSegs.has(firstKey)) {
          tracePath = tracePath.slice(1)
          trimmedFront = true
        }
      }

      // Check if last segment is a duplicate — trim it from this trace
      if (!trimmedFront && tracePath.length > 2) {
        const lastKey = segmentKey(
          tracePath[tracePath.length - 2],
          tracePath[tracePath.length - 1],
        )
        if (duplicateSegs.has(lastKey) && alreadyClaimedSegs.has(lastKey)) {
          tracePath = tracePath.slice(0, -1)
        }
      }

      // Register all segments in this trace as claimed
      for (let i = 0; i < tracePath.length - 1; i++) {
        alreadyClaimedSegs.add(segmentKey(tracePath[i], tracePath[i + 1]))
      }

      result.push({ ...trace, tracePath })
    }
  }

  return result
}
