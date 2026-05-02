import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Checks if two points share the same X coordinate (vertical line)
 */
const isVerticalSegment = (p1: Point, p2: Point): boolean => {
  return p1.x === p2.x
}

/**
 * Checks if two points share the same Y coordinate (horizontal line)
 */
const isHorizontalSegment = (p1: Point, p2: Point): boolean => {
  return p1.y === p2.y
}

/**
 * Checks if two segments are collinear (on the same line)
 */
const areSegmentsCollinear = (
  s1Start: Point,
  s1End: Point,
  s2Start: Point,
  s2End: Point,
): boolean => {
  // Reject zero-length segments - they are degenerate
  if ((s1Start.x === s1End.x && s1Start.y === s1End.y) ||
      (s2Start.x === s2End.x && s2Start.y === s2End.y)) {
    return false
  }

  const s1Vertical = isVerticalSegment(s1Start, s1End)
  const s1Horizontal = isHorizontalSegment(s1Start, s1End)
  const s2Vertical = isVerticalSegment(s2Start, s2End)
  const s2Horizontal = isHorizontalSegment(s2Start, s2End)

  if (s1Vertical && s2Vertical) {
    return s1Start.x === s2Start.x
  }

  if (s1Horizontal && s2Horizontal) {
    return s1Start.y === s2Start.y
  }

  return false
}

/**
 * Checks if two traces can be merged (collinear with adjacent/touching endpoints)
 */
const canMergeTraces = (trace1: SolvedTracePath, trace2: SolvedTracePath): boolean => {
  if (trace1.netId !== trace2.netId) {
    return false
  }

  const t1Start = trace1.tracePath[0]
  const t1End = trace1.tracePath[trace1.tracePath.length - 1]
  const t2Start = trace2.tracePath[0]
  const t2End = trace2.tracePath[trace2.tracePath.length - 1]

  const segmentCollinear = areSegmentsCollinear(t1Start, t1End, t2Start, t2End)

  if (!segmentCollinear) {
    return false
  }

  // Only merge if endpoints are adjacent/touching (within epsilon tolerance)
  const eps = 1e-10
  const dist = (p1: Point, p2: Point): number => Math.hypot(p1.x - p2.x, p1.y - p2.y)

  return (
    dist(t1End, t2Start) < eps ||  // trace1 end touches trace2 start
    dist(t1End, t2End) < eps ||    // trace1 end touches trace2 end
    dist(t1Start, t2Start) < eps || // trace1 start touches trace2 start
    dist(t1Start, t2End) < eps      // trace1 start touches trace2 end
  )
}

/**
 * Merges two collinear traces into one, connecting at their adjacent endpoints
 */
const mergeTwoTraces = (
  trace1: SolvedTracePath,
  trace2: SolvedTracePath,
): SolvedTracePath => {
  const t1Start = trace1.tracePath[0]
  const t1End = trace1.tracePath[trace1.tracePath.length - 1]
  const t2Start = trace2.tracePath[0]
  const t2End = trace2.tracePath[trace2.tracePath.length - 1]

  const eps = 1e-10
  const dist = (p1: Point, p2: Point): number => Math.hypot(p1.x - p2.x, p1.y - p2.y)

  let mergedPath: Point[]

  // Determine which endpoints touch and merge accordingly
  if (dist(t1End, t2Start) < eps) {
    // Ideal case: trace1 end connects to trace2 start
    mergedPath = [...trace1.tracePath, ...trace2.tracePath.slice(1)]
  } else if (dist(t1End, t2End) < eps) {
    // trace1 end connects to trace2 end - reverse trace2
    mergedPath = [...trace1.tracePath, ...trace2.tracePath.reverse().slice(1)]
  } else if (dist(t1Start, t2Start) < eps) {
    // trace1 start connects to trace2 start - reverse trace1
    mergedPath = [...trace2.tracePath, ...trace1.tracePath.reverse().slice(1)]
  } else if (dist(t1Start, t2End) < eps) {
    // trace1 start connects to trace2 end
    mergedPath = [...trace2.tracePath, ...trace1.tracePath.slice(1)]
  } else {
    // Should never happen if canMergeTraces worked correctly
    throw new Error(
      `mergeTwoTraces: No adjacent endpoints found within tolerance. This indicates a bug in canMergeTraces.`
    )
  }

  return {
    ...trace1,
    tracePath: mergedPath,
    mspConnectionPairIds: [
      ...trace1.mspConnectionPairIds,
      ...trace2.mspConnectionPairIds,
    ],
    pinIds: [...trace1.pinIds, ...trace2.pinIds],
  }
}

/**
 * Merges collinear trace lines that share the same net and have overlapping or adjacent segments
 */
export const mergeCollinearTraces = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  if (traces.length <= 1) {
    return traces
  }

  const result = [...traces]
  let merged = true

  while (merged) {
    merged = false

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (canMergeTraces(result[i], result[j])) {
          const mergedTrace = mergeTwoTraces(result[i], result[j])
          result[i] = mergedTrace
          result.splice(j, 1)
          merged = true
          break
        }
      }

      if (merged) break
    }
  }

  return result
}
