import type { Point } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ChipObstacle, PathSegment, SegmentOrientation } from "./types"
import { EPS } from "./types"

export const getPathKey = (path: Point[]) =>
  path.map((point) => `${point.x},${point.y}`).join(";")

export const getPathLength = (path: Point[]) => {
  let length = 0
  for (let i = 0; i < path.length - 1; i++) {
    length +=
      Math.abs(path[i + 1]!.x - path[i]!.x) +
      Math.abs(path[i + 1]!.y - path[i]!.y)
  }
  return length
}

export const getDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export const isAxisAlignedSegment = (start: Point, end: Point) =>
  Math.abs(start.x - end.x) < EPS || Math.abs(start.y - end.y) < EPS

export const getSegmentOrientation = (
  start: Point,
  end: Point,
): SegmentOrientation =>
  Math.abs(start.y - end.y) < EPS ? "horizontal" : "vertical"

export const projectPointToSegment = (
  point: Point,
  start: Point,
  end: Point,
): Point => {
  if (Math.abs(start.x - end.x) < EPS) {
    return {
      x: start.x,
      y: Math.min(
        Math.max(point.y, Math.min(start.y, end.y)),
        Math.max(start.y, end.y),
      ),
    }
  }

  if (Math.abs(start.y - end.y) < EPS) {
    return {
      x: Math.min(
        Math.max(point.x, Math.min(start.x, end.x)),
        Math.max(start.x, end.x),
      ),
      y: start.y,
    }
  }

  return start
}

export const getPointToSegmentDistance = (
  point: Point,
  start: Point,
  end: Point,
) => getDistance(point, projectPointToSegment(point, start, end))

export const getSegments = (path: Point[]) => {
  const segments: PathSegment[] = []

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    if (!isAxisAlignedSegment(start, end)) continue
    segments.push({
      start,
      end,
      orientation: getSegmentOrientation(start, end),
    })
  }

  return segments
}

export const findSegmentContainingPoint = (path: Point[], point: Point) => {
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    if (!isAxisAlignedSegment(start, end)) continue
    if (getPointToSegmentDistance(point, start, end) > 1e-6) continue

    return {
      index: i,
      start,
      end,
      orientation: getSegmentOrientation(start, end),
    }
  }

  return null
}

export const isPointWithinSegmentPrimaryRange = (
  point: Point,
  segment: PathSegment,
) => {
  if (segment.orientation === "horizontal") {
    return (
      point.x >= Math.min(segment.start.x, segment.end.x) - EPS &&
      point.x <= Math.max(segment.start.x, segment.end.x) + EPS
    )
  }

  return (
    point.y >= Math.min(segment.start.y, segment.end.y) - EPS &&
    point.y <= Math.max(segment.start.y, segment.end.y) + EPS
  )
}

export const findPreferredReroutedSegment = (
  path: Point[],
  originalSegmentIndex: number,
  originalSegmentCount: number,
  orientation: SegmentOrientation,
  anchorPoint: Point,
) => {
  const matchingSegments = getSegments(path).filter(
    (segment) => segment.orientation === orientation,
  )
  if (matchingSegments.length === 0) return null

  const containingSegments = matchingSegments.filter((segment) =>
    isPointWithinSegmentPrimaryRange(anchorPoint, segment),
  )
  const candidateSegments =
    containingSegments.length > 0 ? containingSegments : matchingSegments

  const isNearStart = originalSegmentIndex < originalSegmentCount / 2
  return isNearStart
    ? candidateSegments[0]!
    : candidateSegments[candidateSegments.length - 1]!
}

export const projectPointToPath = (point: Point, path: Point[]) => {
  let bestPoint: Point | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < path.length - 1; i++) {
    const projectedPoint = projectPointToSegment(point, path[i]!, path[i + 1]!)
    const distance = getDistance(point, projectedPoint)
    if (distance < bestDistance) {
      bestPoint = projectedPoint
      bestDistance = distance
    }
  }

  return bestPoint
}

export const segmentsIntersect = (
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
) => {
  const aVertical = Math.abs(a1.x - a2.x) < EPS
  const bVertical = Math.abs(b1.x - b2.x) < EPS
  const between = (value: number, p1: number, p2: number) =>
    value >= Math.min(p1, p2) - EPS && value <= Math.max(p1, p2) + EPS

  if (aVertical && bVertical) {
    if (Math.abs(a1.x - b1.x) > EPS) return false
    const overlap =
      Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
      Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
    return overlap > EPS
  }

  if (!aVertical && !bVertical) {
    if (Math.abs(a1.y - b1.y) > EPS) return false
    const overlap =
      Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
      Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
    return overlap > EPS
  }

  const verticalA = aVertical ? a1 : b1
  const verticalB = aVertical ? a2 : b2
  const horizontalA = aVertical ? b1 : a1
  const horizontalB = aVertical ? b2 : a2

  return (
    between(verticalA.x, horizontalA.x, horizontalB.x) &&
    between(horizontalA.y, verticalA.y, verticalB.y)
  )
}

export const countPathIntersections = (pathA: Point[], pathB: Point[]) => {
  let count = 0
  for (let i = 0; i < pathA.length - 1; i++) {
    for (let j = 0; j < pathB.length - 1; j++) {
      if (
        segmentsIntersect(pathA[i]!, pathA[i + 1]!, pathB[j]!, pathB[j + 1]!)
      ) {
        count++
      }
    }
  }
  return count
}

export const isPathCollidingWithChipInterior = (
  path: Point[],
  chipObstacles: ChipObstacle[],
) => {
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    for (const obstacle of chipObstacles) {
      if (!segmentIntersectsRect(start, end, obstacle)) continue
      if (segmentRunsAlongRectBoundary(start, end, obstacle)) continue
      return true
    }
  }
  return false
}

const segmentRunsAlongRectBoundary = (
  start: Point,
  end: Point,
  rect: ChipObstacle,
) => {
  const isVertical = Math.abs(start.x - end.x) < EPS
  const isHorizontal = Math.abs(start.y - end.y) < EPS

  if (isVertical) {
    return (
      Math.abs(start.x - rect.minX) < EPS || Math.abs(start.x - rect.maxX) < EPS
    )
  }

  if (isHorizontal) {
    return (
      Math.abs(start.y - rect.minY) < EPS || Math.abs(start.y - rect.maxY) < EPS
    )
  }

  return false
}
