import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Bounds } from "./types"

export const EPS = 1e-6

export const isTraceLine = (trace: SolvedTracePath) =>
  getUniquePinCount(trace.pinIds) >= 2

export const rectsOverlap = (a: Bounds, b: Bounds) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > EPS &&
  Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > EPS

export const getTraceCorners = (path: Point[]) => {
  const corners: Point[] = []
  for (let i = 1; i < path.length - 1; i++) {
    const previousPoint = path[i - 1]!
    const cornerPoint = path[i]!
    const nextPoint = path[i + 1]!
    if (isTraceCorner(previousPoint, cornerPoint, nextPoint)) {
      corners.push(cornerPoint)
    }
  }
  return corners
}

export const tracePathContainsPoint = (path: Point[], point: Point) => {
  for (let i = 0; i < path.length - 1; i++) {
    if (isPointOnSegment(point, path[i]!, path[i + 1]!)) return true
  }
  return false
}

export const getDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const getUniquePinCount = (pinIds: string[]) => new Set(pinIds).size

const isTraceCorner = (a: Point, b: Point, c: Point) =>
  getSegmentOrientation(a, b) !== getSegmentOrientation(b, c)

const isPointOnSegment = (point: Point, start: Point, end: Point) => {
  if (getSegmentOrientation(start, end) === "horizontal") {
    return (
      Math.abs(point.y - start.y) <= EPS &&
      point.x >= Math.min(start.x, end.x) - EPS &&
      point.x <= Math.max(start.x, end.x) + EPS
    )
  }

  return (
    Math.abs(point.x - start.x) <= EPS &&
    point.y >= Math.min(start.y, end.y) - EPS &&
    point.y <= Math.max(start.y, end.y) + EPS
  )
}

const getSegmentOrientation = (a: Point, b: Point) =>
  Math.abs(a.y - b.y) <= EPS ? "horizontal" : "vertical"
