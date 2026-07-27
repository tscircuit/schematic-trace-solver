import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { TraceObstacle } from "./getTraceObstacles"

const EPS = 1e-6

export interface PerpendicularPathCrossing {
  pathSegmentIndex: number
  otherPathSegmentIndex: number
}

/**
 * Finds all intersection points between a given line segment (p1-p2) and a list of trace obstacles.
 * It iterates through each segment of every obstacle and checks for intersections with the input segment.
 */
export const findIntersectionsWithObstacles = (
  p1: Point,
  p2: Point,
  obstacles: TraceObstacle[],
): Point[] => {
  const intersections: Point[] = []

  for (const obstacle of obstacles) {
    const obstaclePath = obstacle.points
    for (let i = 0; i < obstaclePath.length - 1; i++) {
      const o1 = obstaclePath[i]
      const o2 = obstaclePath[i + 1]

      // Ensure both points are defined before proceeding
      if (!o1 || !o2) {
        // console.warn("Skipping obstacle segment due to undefined point:", { o1, o2, obstaclePath });
        continue
      }

      const intersection = getSegmentIntersection(p1, p2, o1, o2)
      if (intersection) {
        intersections.push(intersection)
      }
    }
  }

  return intersections
}

const isSamePoint = (first: Point, second: Point) =>
  Math.abs(first.x - second.x) < EPS && Math.abs(first.y - second.y) < EPS

export const findPerpendicularPathCrossings = (
  path: Point[],
  otherPath: Point[],
): PerpendicularPathCrossing[] => {
  const crossings: PerpendicularPathCrossing[] = []

  // Terminal segments connect to pins and are allowed to meet other traces at
  // their endpoints. Only internal, strict crossings need to be untangled.
  for (
    let pathSegmentIndex = 1;
    pathSegmentIndex < path.length - 2;
    pathSegmentIndex++
  ) {
    const start = path[pathSegmentIndex]!
    const end = path[pathSegmentIndex + 1]!
    const isVertical = Math.abs(start.x - end.x) < EPS

    for (
      let otherPathSegmentIndex = 1;
      otherPathSegmentIndex < otherPath.length - 2;
      otherPathSegmentIndex++
    ) {
      const otherStart = otherPath[otherPathSegmentIndex]!
      const otherEnd = otherPath[otherPathSegmentIndex + 1]!
      const otherIsVertical = Math.abs(otherStart.x - otherEnd.x) < EPS
      if (isVertical === otherIsVertical) continue

      const intersection = getSegmentIntersection(
        start,
        end,
        otherStart,
        otherEnd,
      )
      if (
        !intersection ||
        [start, end, otherStart, otherEnd].some((point) =>
          isSamePoint(point, intersection),
        )
      ) {
        continue
      }

      crossings.push({ pathSegmentIndex, otherPathSegmentIndex })
    }
  }

  return crossings
}
