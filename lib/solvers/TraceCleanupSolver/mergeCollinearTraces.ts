import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const isVerticalSegment = (p1: Point, p2: Point): boolean => p1.x === p2.x

const isHorizontalSegment = (p1: Point, p2: Point): boolean => p1.y === p2.y

const areSegmentsCollinear = (
  s1Start: Point,
  s1End: Point,
  s2Start: Point,
  s2End: Point,
): boolean => {
  if (
    (s1Start.x === s1End.x && s1Start.y === s1End.y) ||
    (s2Start.x === s2End.x && s2Start.y === s2End.y)
  ) {
    return false
  }
  if (isVerticalSegment(s1Start, s1End) && isVerticalSegment(s2Start, s2End)) {
    return s1Start.x === s2Start.x
  }
  if (
    isHorizontalSegment(s1Start, s1End) &&
    isHorizontalSegment(s2Start, s2End)
  ) {
    return s1Start.y === s2Start.y
  }
  return false
}

const canMergeTraces = (
  trace1: SolvedTracePath,
  trace2: SolvedTracePath,
): boolean => {
  if (trace1.dcConnNetId !== trace2.dcConnNetId) return false

  const t1Start = trace1.tracePath[0]
  const t1End = trace1.tracePath[trace1.tracePath.length - 1]
  const t2Start = trace2.tracePath[0]
  const t2End = trace2.tracePath[trace2.tracePath.length - 1]

  if (!areSegmentsCollinear(t1Start, t1End, t2Start, t2End)) return false

  const eps = 1e-10
  const dist = (p1: Point, p2: Point): number =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y)

  return (
    dist(t1End, t2Start) < eps ||
    dist(t1End, t2End) < eps ||
    dist(t1Start, t2Start) < eps ||
    dist(t1Start, t2End) < eps
  )
}

const mergeTwoTraces = (
  trace1: SolvedTracePath,
  trace2: SolvedTracePath,
): SolvedTracePath => {
  const t1Start = trace1.tracePath[0]
  const t1End = trace1.tracePath[trace1.tracePath.length - 1]
  const t2Start = trace2.tracePath[0]
  const t2End = trace2.tracePath[trace2.tracePath.length - 1]

  const eps = 1e-10
  const dist = (p1: Point, p2: Point): number =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y)

  let mergedPath: Point[]

  if (dist(t1End, t2Start) < eps) {
    mergedPath = [...trace1.tracePath, ...trace2.tracePath.slice(1)]
  } else if (dist(t1End, t2End) < eps) {
    mergedPath = [
      ...trace1.tracePath,
      ...[...trace2.tracePath].reverse().slice(1),
    ]
  } else if (dist(t1Start, t2Start) < eps) {
    mergedPath = [
      ...trace2.tracePath,
      ...[...trace1.tracePath].reverse().slice(1),
    ]
  } else if (dist(t1Start, t2End) < eps) {
    mergedPath = [...trace2.tracePath, ...trace1.tracePath.slice(1)]
  } else {
    throw new Error(
      "mergeTwoTraces: No adjacent endpoints found within tolerance.",
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

export const mergeCollinearTraces = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  if (traces.length <= 1) return traces

  const result = [...traces]
  let merged = true

  while (merged) {
    merged = false
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (canMergeTraces(result[i], result[j])) {
          result[i] = mergeTwoTraces(result[i], result[j])
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
