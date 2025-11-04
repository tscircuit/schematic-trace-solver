import type { Point } from "@tscircuit/math-utils"
import { segmentToBoxMinDistance } from "@tscircuit/math-utils"

/**
 * Checks if a given path (series of segments) collides with any of the provided obstacles.
 * It iterates through each segment of the path and checks for intersection with each obstacle.
 */
export const hasCollisions = (
  pathSegments: Point[],
  obstacles: Array<{ minX: number; maxX: number; minY: number; maxY: number }>,
): boolean => {
  // Check each segment of the path
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const p1 = pathSegments[i]
    const p2 = pathSegments[i + 1]

    // Check collision with each obstacle
    for (const obstacle of obstacles) {
      const box = {
        center: {
          x: obstacle.minX + (obstacle.maxX - obstacle.minX) / 2,
          y: obstacle.minY + (obstacle.maxY - obstacle.minY) / 2,
        },
        width: obstacle.maxX - obstacle.minX,
        height: obstacle.maxY - obstacle.minY,
      }
      if (segmentToBoxMinDistance(p1, p2, box) <= 0) {
        return true
      }
    }
  }

  return false
}
