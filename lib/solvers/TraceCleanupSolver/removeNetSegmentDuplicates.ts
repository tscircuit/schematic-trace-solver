import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPSILON = 1e-9

/**
 * Creates a canonical (direction-independent) key for a segment defined by two points.
 * Sorts the endpoints so that the key is the same regardless of traversal direction.
 */
function getSegmentKey(ax: number, ay: number, bx: number, by: number): string {
  // Sort endpoints: first by x, then by y
  if (ax < bx - EPSILON || (Math.abs(ax - bx) < EPSILON && ay < by - EPSILON)) {
    return `${ax.toFixed(9)},${ay.toFixed(9)}-${bx.toFixed(9)},${by.toFixed(9)}`
  }
  return `${bx.toFixed(9)},${by.toFixed(9)}-${ax.toFixed(9)},${ay.toFixed(9)}`
}

/**
 * Removes duplicate trace segments that appear when multiple MSP connection pairs
 * in the same net share a pin endpoint and independently route through the same
 * physical segment near that shared pin.
 *
 * For each net, the first trace that uses a segment keeps it; subsequent traces
 * that start or end with the same segment have those endpoint segments trimmed.
 *
 * Only endpoint segments (first or last) are candidates for trimming, since
 * those are the ones that overlap near shared pin endpoints.
 */
export function removeNetSegmentDuplicates(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  // Group traces by globalConnNetId
  const tracesByNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!tracesByNet.has(netId)) {
      tracesByNet.set(netId, [])
    }
    tracesByNet.get(netId)!.push(trace)
  }

  const result: SolvedTracePath[] = []

  for (const [_netId, netTraces] of tracesByNet) {
    if (netTraces.length <= 1) {
      result.push(...netTraces)
      continue
    }

    // Collect all segments from all traces in this net, tracking which trace
    // index first claimed each segment
    const claimedSegments = new Set<string>()

    // First pass: register all segments from the first trace (it keeps everything)
    const firstTrace = netTraces[0]
    for (let i = 0; i < firstTrace.tracePath.length - 1; i++) {
      const p1 = firstTrace.tracePath[i]
      const p2 = firstTrace.tracePath[i + 1]
      claimedSegments.add(getSegmentKey(p1.x, p1.y, p2.x, p2.y))
    }
    result.push(firstTrace)

    // Second pass: for subsequent traces, trim duplicate endpoint segments
    for (let t = 1; t < netTraces.length; t++) {
      const trace = netTraces[t]
      const path = [...trace.tracePath]

      // Trim from the start: remove leading segments that are duplicates
      while (path.length >= 2) {
        const key = getSegmentKey(path[0].x, path[0].y, path[1].x, path[1].y)
        if (claimedSegments.has(key)) {
          path.shift()
        } else {
          break
        }
      }

      // Trim from the end: remove trailing segments that are duplicates
      while (path.length >= 2) {
        const key = getSegmentKey(
          path[path.length - 2].x,
          path[path.length - 2].y,
          path[path.length - 1].x,
          path[path.length - 1].y,
        )
        if (claimedSegments.has(key)) {
          path.pop()
        } else {
          break
        }
      }

      // Register this trace's remaining segments as claimed
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]
        const p2 = path[i + 1]
        claimedSegments.add(getSegmentKey(p1.x, p1.y, p2.x, p2.y))
      }

      // Only keep traces that still have at least 2 points (a valid segment)
      if (path.length >= 2) {
        result.push({
          ...trace,
          tracePath: path,
        })
      } else {
        // Trace was entirely duplicated; still include it but with original path
        // to avoid breaking downstream references
        result.push(trace)
      }
    }
  }

  return result
}
