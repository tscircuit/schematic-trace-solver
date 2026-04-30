import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Removes duplicate net segments from traces.
 *
 * When two pairs in the same net share a pin, both route through the same
 * physical segment near that shared endpoint. This creates "extra trace lines"
 * in the rendered schematic.
 *
 * This function:
 * 1. Groups traces by net ID
 * 2. Finds segments that appear in more than one trace
 * 3. Trims redundant endpoint segments from later traces
 */
export function removeNetSegmentDuplicates(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  if (traces.length === 0) return traces

  // Group traces by net ID
  const tracesByNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!tracesByNet.has(netId)) {
      tracesByNet.set(netId, [])
    }
    tracesByNet.get(netId)!.push(trace)
  }

  // Process each net group
  const result: SolvedTracePath[] = []

  for (const [netId, netTraces] of tracesByNet) {
    if (netTraces.length < 2) {
      // No duplicates possible with single trace
      result.push(...netTraces)
      continue
    }

    // Track which segments have been "claimed" by earlier traces
    const claimedSegments: Set<string> = new Set()

    // Process traces in order
    for (let i = 0; i < netTraces.length; i++) {
      const trace = netTraces[i]
      const newPath = removeDuplicateEndpointSegments(
        trace.tracePath,
        claimedSegments,
      )

      // Mark all segments in the new path as claimed
      for (let j = 0; j < newPath.length - 1; j++) {
        const segKey = segmentKey(newPath[j], newPath[j + 1])
        claimedSegments.add(segKey)
      }

      result.push({
        ...trace,
        tracePath: newPath,
      })
    }
  }

  return result
}

/**
 * Remove endpoint segments that have already been claimed by other traces.
 */
function removeDuplicateEndpointSegments(
  path: Point[],
  claimedSegments: Set<string>,
): Point[] {
  if (path.length < 3 || claimedSegments.size === 0) {
    return path
  }

  // Check if first segment is claimed
  let startIdx = 0
  if (isSegmentClaimed(path[0], path[1], claimedSegments)) {
    // Find first unclaimed segment start
    for (let i = 1; i < path.length - 1; i++) {
      if (!isSegmentClaimed(path[i], path[i + 1], claimedSegments)) {
        startIdx = i
        break
      }
    }
  }

  // Check if last segment is claimed
  let endIdx = path.length - 1
  if (
    isSegmentClaimed(
      path[path.length - 2],
      path[path.length - 1],
      claimedSegments,
    )
  ) {
    // Find last unclaimed segment end
    for (let i = path.length - 2; i > startIdx; i--) {
      if (!isSegmentClaimed(path[i - 1], path[i], claimedSegments)) {
        endIdx = i + 1
        break
      }
    }
  }

  if (startIdx === 0 && endIdx === path.length - 1) {
    return path
  }

  return path.slice(startIdx, endIdx + 1)
}

/**
 * Create a unique key for a segment (order-independent).
 */
function segmentKey(p1: Point, p2: Point): string {
  const dx = Math.min(p1.x, p2.x)
  const dy = Math.min(p1.y, p2.y)
  const dx2 = Math.max(p1.x, p2.x)
  const dy2 = Math.max(p1.y, p2.y)
  return `${dx},${dy}-${dx2},${dy2}`
}

/**
 * Check if a segment has been claimed (using the same key logic).
 */
function isSegmentClaimed(
  p1: Point,
  p2: Point,
  claimedSegments: Set<string>,
): boolean {
  return claimedSegments.has(segmentKey(p1, p2))
}

/**
 * Alternative approach: Find and remove truly duplicate segments
 * (same net, overlapping segments).
 */
export function removeDuplicateSegmentsFromTraces(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  // Group by net
  const tracesByNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!tracesByNet.has(netId)) {
      tracesByNet.set(netId, [])
    }
    tracesByNet.get(netId)!.push(trace)
  }

  const result: SolvedTracePath[] = []

  for (const [netId, netTraces] of tracesByNet) {
    if (netTraces.length < 2) {
      result.push(...netTraces)
      continue
    }

    // Track all segments that have been claimed
    const claimedSegments: Set<string> = new Set()

    for (const trace of netTraces) {
      const newPath = removeDuplicateEndpointSegments(
        trace.tracePath,
        claimedSegments,
      )

      // Mark segments as claimed
      for (let j = 0; j < newPath.length - 1; j++) {
        claimedSegments.add(segmentKey(newPath[j], newPath[j + 1]))
      }

      result.push({
        ...trace,
        tracePath: newPath,
      })
    }
  }

  return result
}
