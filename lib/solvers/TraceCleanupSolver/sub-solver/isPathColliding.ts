import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"

export type CollisionInfo = {
  isColliding: boolean
  collidingTraceId?: string
  collisionPoint?: Point
}

export const isPathColliding = (
  path: Point[],
  allTraces: SolvedTracePath[],
  traceIdToExclude?: string,
): CollisionInfo => {
  if (path.length < 2) {
    return { isColliding: false }
  }

  for (let i = 0; i < path.length - 1; i++) {
    const pathSegP1 = path[i]
    const pathSegQ1 = path[i + 1]

    for (const existingTrace of allTraces) {
      if (existingTrace.mspPairId === traceIdToExclude) {
        continue // Skip self-collision check
      }

      for (let j = 0; j < existingTrace.tracePath.length - 1; j++) {
        const existingSegP2 = existingTrace.tracePath[j]
        const existingSegQ2 = existingTrace.tracePath[j + 1]

        const intersectionPoint = getSegmentIntersection(
          pathSegP1,
          pathSegQ1,
          existingSegP2,
          existingSegQ2,
        )

        if (intersectionPoint) {
          return {
            isColliding: true,
            collidingTraceId: existingTrace.mspPairId as string,
            collisionPoint: intersectionPoint,
          }
        }
      }
    }
  }

  return { isColliding: false } // No collision found
}
