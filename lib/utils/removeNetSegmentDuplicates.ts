import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-9

interface Segment {
  p1: Point
  p2: Point
}

/**
 * Normalise a segment so that the "smaller" point comes first,
 * enabling consistent comparison regardless of direction.
 */
function normalizeSegment(seg: Segment): Segment {
  if (
    seg.p1.x < seg.p2.x - EPS ||
    (Math.abs(seg.p1.x - seg.p2.x) < EPS && seg.p1.y < seg.p2.y - EPS)
  ) {
    return seg
  }
  return { p1: seg.p2, p2: seg.p1 }
}

function segmentKey(seg: Segment): string {
  const n = normalizeSegment(seg)
  return `${n.p1.x.toFixed(8)},${n.p1.y.toFixed(8)}->${n.p2.x.toFixed(8)},${n.p2.y.toFixed(8)}`
}

/**
 * Given a set of traces that belong to the same net, detect segments
 * that appear in more than one trace. For each duplicate segment found
 * in a non-primary trace, remove it by collapsing the two endpoints
 * into a single point (keep the first endpoint).
 *
 * This prevents the "extra trace lines" artefact where two MSP-pair
 * traces in the same net share a physical segment near a common pin.
 */
export function removeNetSegmentDuplicates(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  // Group traces by net (using globalConnNetId)
  const netGroups = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId ?? trace.dcConnNetId
    if (!netGroups.has(netId)) {
      netGroups.set(netId, [])
    }
    netGroups.get(netId)!.push(trace)
  }

  const result: SolvedTracePath[] = []

  for (const [_netId, group] of netGroups) {
    if (group.length <= 1) {
      result.push(...group)
      continue
    }

    // Collect all segments from the first (primary) trace as the reference set
    const seenSegments = new Set<string>()
    const primaryTrace = group[0]
    for (let i = 0; i < primaryTrace.tracePath.length - 1; i++) {
      const key = segmentKey({
        p1: primaryTrace.tracePath[i],
        p2: primaryTrace.tracePath[i + 1],
      })
      seenSegments.add(key)
    }
    result.push(primaryTrace)

    // For subsequent traces in the same net, filter out duplicate segments
    for (let t = 1; t < group.length; t++) {
      const trace = group[t]
      const path = trace.tracePath
      const newPath: Point[] = [path[0]]

      for (let i = 0; i < path.length - 1; i++) {
        const key = segmentKey({ p1: path[i], p2: path[i + 1] })
        if (seenSegments.has(key)) {
          // Skip the duplicate segment – don't add the next point
          continue
        }
        seenSegments.add(key)
        newPath.push(path[i + 1])
      }

      // Ensure at least 2 points to form a valid trace
      if (newPath.length < 2) {
        result.push(trace)
      } else {
        result.push({
          ...trace,
          tracePath: newPath,
        })
      }
    }
  }

  return result
}
