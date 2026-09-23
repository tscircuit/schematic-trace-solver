import type { Point } from "@tscircuit/math-utils"

export const DEFAULT_TRACE_CLEARANCE = 0.2
export const TRACE_COORDINATE_EPSILON = 1e-9

export const tracePointsMatch = (firstPoint: Point, secondPoint: Point) =>
  Math.abs(firstPoint.x - secondPoint.x) <= TRACE_COORDINATE_EPSILON &&
  Math.abs(firstPoint.y - secondPoint.y) <= TRACE_COORDINATE_EPSILON

export const removeConsecutiveDuplicateTracePoints = (path: Point[]) =>
  path.filter(
    (point, index) => index === 0 || !tracePointsMatch(point, path[index - 1]!),
  )
