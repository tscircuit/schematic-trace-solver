import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { TraceObstacle } from "./getTraceObstacles"

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
