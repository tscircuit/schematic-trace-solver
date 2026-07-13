import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Removes duplicate net segments from traces.
 *
 * When two pairs in the same net share a pin, both route through the same
 * physical segment near that shared endpoint. This creates "extra trace lines"
 * in the rendered schematic.
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
      result.push(...netTraces)
      continue
    }

    // Track which segments have been "claimed"
    const claimedSegments: Set<string> = new Set()

    for (const trace of netTraces) {
      const newPath = removeDuplicateEndpointSegments(
        trace.tracePath,
        claimedSegments,
      )

      for (let j = 0; j < newPath.length - 1; j++) {
        claimedSegments.add(segmentKey(newPath[j], newPath[j + 1]))
      }

      result.push({ ...trace, tracePath: newPath })
    }
  }

  return result
}

function removeDuplicateEndpointSegments(
  path: Point[],
  claimedSegments: Set<string>,
): Point[] {
  if (path.length < 3 || claimedSegments.size === 0) {
    return path
  }

  let startIdx = 0
  if (isSegmentClaimed(path[0], path[1], claimedSegments)) {
    for (let i = 1; i < path.length - 1; i++) {
      if (!isSegmentClaimed(path[i], path[i + 1], claimedSegments)) {
        startIdx = i
        break
      }
    }
  }

  let endIdx = path.length - 1
  if (
    isSegmentClaimed(
      path[path.length - 2],
      path[path.length - 1],
      claimedSegments,
    )
  ) {
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

function segmentKey(p1: Point, p2: Point): string {
  const dx = Math.min(p1.x, p2.x)
  const dy = Math.min(p1.y, p2.y)
  const dx2 = Math.max(p1.x, p2.x)
  const dy2 = Math.max(p1.y, p2.y)
  return `${dx},${dy}-${dx2},${dy2}`
}

function isSegmentClaimed(
  p1: Point,
  p2: Point,
  claimedSegments: Set<string>,
): boolean {
  return claimedSegments.has(segmentKey(p1, p2))
}
