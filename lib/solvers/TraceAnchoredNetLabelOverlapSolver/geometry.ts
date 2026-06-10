import type { Point } from "@tscircuit/math-utils"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { FacingDirection } from "lib/utils/dir"
import type { Bounds, TraceLocation } from "./types"

export const EPS = 1e-6
export const TRACE_BOUNDARY_TOLERANCE = 1e-6

export const getLabelBounds = (label: {
  center: Point
  width: number
  height: number
}) => getRectBounds(label.center, label.width, label.height)

export const rectsOverlap = (a: Bounds, b: Bounds) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > EPS &&
  Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > EPS

export const rectsTouchOrOverlap = (a: Bounds, b: Bounds) =>
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) >= -EPS &&
  Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) >= -EPS

export const traceCrossesBoundsInterior = (
  bounds: Bounds,
  traces: SolvedTracePath[],
) => {
  for (const trace of traces) {
    const points = trace.tracePath
    for (let i = 0; i < points.length - 1; i++) {
      if (segmentCrossesBoundsInterior(points[i]!, points[i + 1]!, bounds)) {
        return true
      }
    }
  }

  return false
}

export const getTraceLocationsForPoint = (
  point: Point,
  traces: SolvedTracePath[],
) => {
  const locations: TraceLocation[] = []

  for (const trace of traces) {
    if (getUniquePinCount(trace.pinIds) < 2) continue

    let pathDistance = 0
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const start = trace.tracePath[i]!
      const end = trace.tracePath[i + 1]!
      const segmentLength = getManhattanDistance(start, end)

      if (isPointOnSegment(point, start, end)) {
        locations.push({
          trace,
          distance: pathDistance + getManhattanDistance(start, point),
        })
      }

      pathDistance += segmentLength
    }
  }

  return locations
}

export const getTraceLength = (trace: SolvedTracePath) => {
  let length = 0
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    length += getManhattanDistance(trace.tracePath[i]!, trace.tracePath[i + 1]!)
  }
  return length
}

export const getPointAtTraceDistance = (
  trace: SolvedTracePath,
  distance: number,
) => {
  let pathDistance = 0

  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const start = trace.tracePath[i]!
    const end = trace.tracePath[i + 1]!
    const segmentLength = getManhattanDistance(start, end)
    const nextDistance = pathDistance + segmentLength

    if (distance <= nextDistance + EPS) {
      const offset = Math.max(
        0,
        Math.min(segmentLength, distance - pathDistance),
      )
      const direction = getSegmentDirection(start, end)
      return {
        x: start.x + direction.x * offset,
        y: start.y + direction.y * offset,
      }
    }

    pathDistance = nextDistance
  }

  return trace.tracePath[trace.tracePath.length - 1]!
}

export const getTraceVertexDistances = (trace: SolvedTracePath) => {
  const distances: number[] = []
  let pathDistance = 0

  for (let i = 0; i < trace.tracePath.length; i++) {
    distances.push(pathDistance)
    const nextPoint = trace.tracePath[i + 1]
    if (nextPoint) {
      pathDistance += getManhattanDistance(trace.tracePath[i]!, nextPoint)
    }
  }

  return distances
}

export const getTraceDistanceCompatibleOrientations = (
  trace: SolvedTracePath,
  distance: number,
) => {
  const orientations = new Set<FacingDirection>()
  let pathDistance = 0

  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const start = trace.tracePath[i]!
    const end = trace.tracePath[i + 1]!
    const segmentLength = getManhattanDistance(start, end)
    const nextDistance = pathDistance + segmentLength

    if (distance >= pathDistance - EPS && distance <= nextDistance + EPS) {
      addSegmentCompatibleOrientations(orientations, trace, i)
      if (Math.abs(distance - pathDistance) <= EPS) {
        addSegmentCompatibleOrientations(orientations, trace, i - 1)
      }
      if (Math.abs(distance - nextDistance) <= EPS) {
        addSegmentCompatibleOrientations(orientations, trace, i + 1)
      }
      return orientations
    }

    pathDistance = nextDistance
  }

  return orientations
}

export const getManhattanDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const addSegmentCompatibleOrientations = (
  orientations: Set<FacingDirection>,
  trace: SolvedTracePath,
  segmentIndex: number,
) => {
  const start = trace.tracePath[segmentIndex]
  const end = trace.tracePath[segmentIndex + 1]
  if (!start || !end) return

  if (isHorizontal(start, end)) {
    orientations.add("y+")
    orientations.add("y-")
  } else if (isVertical(start, end)) {
    orientations.add("x+")
    orientations.add("x-")
  }
}

const segmentCrossesBoundsInterior = (
  start: Point,
  end: Point,
  bounds: Bounds,
) => {
  const interior = {
    minX: bounds.minX + TRACE_BOUNDARY_TOLERANCE,
    minY: bounds.minY + TRACE_BOUNDARY_TOLERANCE,
    maxX: bounds.maxX - TRACE_BOUNDARY_TOLERANCE,
    maxY: bounds.maxY - TRACE_BOUNDARY_TOLERANCE,
  }

  if (interior.minX >= interior.maxX || interior.minY >= interior.maxY) {
    return false
  }

  if (isVertical(start, end)) {
    if (start.x <= interior.minX + EPS || start.x >= interior.maxX - EPS) {
      return false
    }
    return rangesOverlap(
      Math.min(start.y, end.y),
      Math.max(start.y, end.y),
      interior.minY,
      interior.maxY,
    )
  }

  if (isHorizontal(start, end)) {
    if (start.y <= interior.minY + EPS || start.y >= interior.maxY - EPS) {
      return false
    }
    return rangesOverlap(
      Math.min(start.x, end.x),
      Math.max(start.x, end.x),
      interior.minX,
      interior.maxX,
    )
  }

  return false
}

const isPointOnSegment = (point: Point, start: Point, end: Point) => {
  if (isHorizontal(start, end)) {
    return (
      Math.abs(point.y - start.y) <= EPS &&
      point.x >= Math.min(start.x, end.x) - EPS &&
      point.x <= Math.max(start.x, end.x) + EPS
    )
  }

  if (isVertical(start, end)) {
    return (
      Math.abs(point.x - start.x) <= EPS &&
      point.y >= Math.min(start.y, end.y) - EPS &&
      point.y <= Math.max(start.y, end.y) + EPS
    )
  }

  return false
}

const getSegmentDirection = (start: Point, end: Point) => ({
  x: isVertical(start, end) ? 0 : Math.sign(end.x - start.x),
  y: isHorizontal(start, end) ? 0 : Math.sign(end.y - start.y),
})

const isHorizontal = (start: Point, end: Point) =>
  Math.abs(start.y - end.y) <= EPS

const isVertical = (start: Point, end: Point) =>
  Math.abs(start.x - end.x) <= EPS

const rangesOverlap = (
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
) => Math.min(maxA, maxB) - Math.max(minA, minB) > EPS

const getUniquePinCount = (pinIds: string[]) => new Set(pinIds).size
