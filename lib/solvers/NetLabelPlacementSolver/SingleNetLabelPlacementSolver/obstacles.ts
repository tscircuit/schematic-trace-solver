import type { InputObstacle } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

/**
 * Obstacle keep-outs are only enforced for labels restricted to vertical
 * (rail-style power/ground) orientations.
 */
export const shouldAvoidObstacles = (
  availableOrientations: FacingDirection[],
): boolean =>
  availableOrientations.length > 0 &&
  availableOrientations.every((o) => o === "y+" || o === "y-")

export const rectOverlapsAnyObstacle = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  obstacles: InputObstacle[] | undefined,
): boolean => {
  if (!obstacles || obstacles.length === 0) return false
  for (const obstacle of obstacles) {
    const halfW = obstacle.width / 2
    const halfH = obstacle.height / 2
    if (
      bounds.minX <= obstacle.center.x + halfW &&
      bounds.maxX >= obstacle.center.x - halfW &&
      bounds.minY <= obstacle.center.y + halfH &&
      bounds.maxY >= obstacle.center.y - halfH
    ) {
      return true
    }
  }
  return false
}
