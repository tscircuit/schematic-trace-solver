import type { Point } from "graphics-debug"
import {
  isVertical,
  isHorizontal,
  segmentIntersectsRect,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const hasCollisions = (
  pathSegments: Point[],
  obstacles: any[],
): boolean => {
  // Check each segment of the path
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const p1 = pathSegments[i]
    const p2 = pathSegments[i + 1]

    // Check collision with each obstacle
    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(p1, p2, obstacle)) {
        return true
      }
    }
  }

  return false
}
