import type { Point } from "@tscircuit/math-utils"

export const DEFAULT_TRACE_CLEARANCE = 0.2
export const TRACE_COORDINATE_EPSILON = 1e-9

export const traceCoordinatesMatch = (
  firstCoordinate: number,
  secondCoordinate: number,
) => Math.abs(firstCoordinate - secondCoordinate) <= TRACE_COORDINATE_EPSILON

export const tracePointsMatch = (firstPoint: Point, secondPoint: Point) =>
  traceCoordinatesMatch(firstPoint.x, secondPoint.x) &&
  traceCoordinatesMatch(firstPoint.y, secondPoint.y)

export const removeConsecutiveDuplicateTracePoints = (path: Point[]) =>
  path.filter(
    (point, index) => index === 0 || !tracePointsMatch(point, path[index - 1]!),
  )
