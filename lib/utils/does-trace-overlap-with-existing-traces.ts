import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  doSegmentsIntersect,
  getSegmentIntersection,
} from "@tscircuit/math-utils"

const pointsEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y

/**
 * Returns true when two segments only touch at a single shared point that is
 * an endpoint of both segments (no interior crossing or collinear overlap).
 */
function isEndpointOnlyTouch(
  ns1: Point,
  ns2: Point,
  es1: Point,
  es2: Point,
): boolean {
  const intersection = getSegmentIntersection(ns1, ns2, es1, es2)
  if (intersection) {
    // Proper crossing — not endpoint-only
    // But if intersection equals both an endpoint of new and existing it's
    // a shared-endpoint touch.
    const atNewEndpoint =
      pointsEqual(intersection, ns1) || pointsEqual(intersection, ns2)
    const atExistingEndpoint =
      pointsEqual(intersection, es1) || pointsEqual(intersection, es2)
    return atNewEndpoint && atExistingEndpoint
  }

  // getSegmentIntersection returns null for collinear segments.
  // Check whether they are collinear by seeing if any endpoint is interior.
  // If only a shared endpoint touches (and no interior overlap), it's still fine.
  for (const np of [ns1, ns2]) {
    if (!pointsEqual(np, es1) && !pointsEqual(np, es2)) {
      // np is not an endpoint of existing — check if it is interior
      if (doSegmentsIntersect(np, np, es1, es2)) return false // interior overlap
    }
  }
  for (const ep of [es1, es2]) {
    if (!pointsEqual(ep, ns1) && !pointsEqual(ep, ns2)) {
      if (doSegmentsIntersect(ep, ep, ns1, ns2)) return false // interior overlap
    }
  }

  // Only shared endpoints — this is fine
  return true
}

/**
 * Trims a new trace path to the first point where it meets an existing trace
 * on the same net.  When a long-distance route overlaps or retraces part of an
 * already-solved same-net segment, we only need to route up to the junction
 * point — the remainder is already covered by the existing trace.
 *
 * Returns the trimmed path, or the original path if no junction is found.
 */
export function trimTraceToSameNetJunction(
  newTracePath: Point[],
  existingTraces: SolvedTracePath[],
  newTraceNetId: string,
): Point[] {
  // Walk new-trace segments in order and find the earliest touch with a same-net trace.
  // Skip i=0 touching at ns1 (the start pin is part of the net already).
  for (let i = 0; i < newTracePath.length - 1; i++) {
    const ns1 = newTracePath[i]
    const ns2 = newTracePath[i + 1]

    for (const existingTrace of existingTraces) {
      if (existingTrace.globalConnNetId !== newTraceNetId) continue

      for (let j = 0; j < existingTrace.tracePath.length - 1; j++) {
        const es1 = existingTrace.tracePath[j]
        const es2 = existingTrace.tracePath[j + 1]

        if (!doSegmentsIntersect(ns1, ns2, es1, es2)) continue

        const intersection = getSegmentIntersection(ns1, ns2, es1, es2)

        // Determine the junction point.
        let junctionPoint: Point | null = intersection
        if (!junctionPoint) {
          // Collinear overlap — find the first existing endpoint on the new
          // segment, closest to ns1.
          const candidates: Point[] = []
          for (const ep of [es1, es2]) {
            if (doSegmentsIntersect(ns1, ns2, ep, ep)) candidates.push(ep)
          }
          if (doSegmentsIntersect(es1, es2, ns2, ns2)) candidates.push(ns2)
          if (candidates.length === 0) continue

          const dist = (p: Point) =>
            Math.sqrt((p.x - ns1.x) ** 2 + (p.y - ns1.y) ** 2)
          junctionPoint = candidates.reduce((a, b) =>
            dist(a) <= dist(b) ? a : b,
          )
        }

        // If junction is at ns1 (start of this segment) and it's also the
        // start of the entire trace, that's just the source pin touching its
        // own net — skip.
        if (i === 0 && pointsEqual(junctionPoint, ns1)) continue

        // Trim: keep points 0..i (up to ns1), then append junction point.
        const trimmed = newTracePath.slice(0, i + 1)
        if (!pointsEqual(trimmed[trimmed.length - 1], junctionPoint)) {
          trimmed.push(junctionPoint)
        }
        return trimmed
      }
    }
  }

  return newTracePath
}

/**
 * Returns true if newTracePath has a real crossing or overlap with any of the
 * existing traces.
 *
 * When newTraceNetId is provided, endpoint-only touches between the new trace
 * and same-net existing traces are treated as valid schematic junctions (not
 * overlaps).  This is needed after trimTraceToSameNetJunction — the trimmed
 * path ends exactly on the existing net, so its last point legitimately shares
 * an endpoint with the existing trace.
 */
export function doesTraceOverlapWithExistingTraces(
  newTracePath: Point[],
  existingTraces: SolvedTracePath[],
  newTraceNetId?: string,
): boolean {
  const newTraceStart = newTracePath[0]
  const newTraceEnd = newTracePath[newTracePath.length - 1]

  for (let i = 0; i < newTracePath.length - 1; i++) {
    const newSegmentP1 = newTracePath[i]
    const newSegmentP2 = newTracePath[i + 1]

    for (const existingTrace of existingTraces) {
      const sameNet =
        newTraceNetId !== undefined &&
        existingTrace.globalConnNetId === newTraceNetId

      for (let j = 0; j < existingTrace.tracePath.length - 1; j++) {
        const existingSegmentP1 = existingTrace.tracePath[j]
        const existingSegmentP2 = existingTrace.tracePath[j + 1]

        if (
          !doSegmentsIntersect(
            newSegmentP1,
            newSegmentP2,
            existingSegmentP1,
            existingSegmentP2,
          )
        ) {
          continue
        }

        // For same-net traces, allow endpoint-only touches at the terminal
        // points of the new trace (the start pin and the trimmed junction).
        if (sameNet) {
          const touchIsAtNewEndpoint =
            pointsEqual(newSegmentP1, newTraceStart) ||
            pointsEqual(newSegmentP2, newTraceStart) ||
            pointsEqual(newSegmentP1, newTraceEnd) ||
            pointsEqual(newSegmentP2, newTraceEnd)

          if (
            touchIsAtNewEndpoint &&
            isEndpointOnlyTouch(
              newSegmentP1,
              newSegmentP2,
              existingSegmentP1,
              existingSegmentP2,
            )
          ) {
            continue
          }
        }

        return true // Found a real intersection
      }
    }
  }

  return false // No intersections found
}
