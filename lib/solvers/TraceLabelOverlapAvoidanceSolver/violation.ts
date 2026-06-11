import type { Point } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"

/**
 * Finds the range of path vertices that violate (cross into) the label
 * bounds. Works for segments that cross the bounds without having any
 * vertex inside: in that case firstInsideIndex/lastInsideIndex bracket the
 * crossing segment(s), so callers can still snip between the vertex before
 * the first crossing and the vertex after the last crossing.
 */
export const findTraceViolationZone = (
  path: Point[],
  labelBounds: { minX: number; maxX: number; minY: number; maxY: number },
) => {
  let firstIntersectingSegIndex = -1
  let lastIntersectingSegIndex = -1

  for (let i = 0; i < path.length - 1; i++) {
    if (segmentIntersectsRect(path[i], path[i + 1], labelBounds)) {
      if (firstIntersectingSegIndex === -1) {
        firstIntersectingSegIndex = i
      }
      lastIntersectingSegIndex = i
    }
  }

  if (firstIntersectingSegIndex === -1) {
    return { firstInsideIndex: -1, lastInsideIndex: -1 }
  }

  return {
    firstInsideIndex: firstIntersectingSegIndex + 1,
    lastInsideIndex: lastIntersectingSegIndex,
  }
}
