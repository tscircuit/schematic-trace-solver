import type { Point } from "graphics-debug"
import { hasCollisions } from "./hasCollisions"
import { countTurns } from "./countTurns"
import { simplifyPath } from "./simplifyPath"
import { tryConnectPoints } from "./tryConnectPoints"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"
import { recognizeStairStepPattern } from "./recognizeStairStepPattern"
import { isSegmentAnEndpointSegment } from "./isSegmentAnEndpointSegment"

/**
 * Minimizes the number of turns in a given path while avoiding collisions with obstacles and labels.
 * This function employs an iterative approach, attempting to simplify the path in several ways:
 * 1. **Stair-step pattern recognition**: It first looks for and attempts to simplify stair-step patterns by connecting the start and end points of the pattern with a simpler path, if no collisions are introduced.
 * 2. **Point removal and reconnection**: If no stair-step optimization is possible, it tries to remove intermediate points and reconnect the remaining segments with a simpler path, prioritizing solutions that reduce turns or path length.
 * 3. **Collinear segment merging**: Finally, it attempts to merge collinear segments to further simplify the path.
 * The process continues until no further improvements can be made without introducing collisions.
 */
export const minimizeTurns = ({
  path,
  obstacles,
  labelBounds,
  originalPath,
}: {
  path: Point[]
  obstacles: any[]
  labelBounds: any[]
  originalPath: Point[]
}): Point[] => {
  if (path.length <= 2) {
    return path
  }

  let optimizedPath = [...path]
  let currentTurns = countTurns(optimizedPath)
  let improved = true

  while (improved) {
    improved = false

    // First try to identify and replace stair-step patterns
    for (let startIdx = 0; startIdx < optimizedPath.length - 3; startIdx++) {
      const stairEndIdx = recognizeStairStepPattern(optimizedPath, startIdx)

      if (stairEndIdx > 0) {
        if (
          isSegmentAnEndpointSegment(
            optimizedPath[startIdx],
            optimizedPath[startIdx + 1],
            originalPath,
          ) ||
          isSegmentAnEndpointSegment(
            optimizedPath[stairEndIdx - 1],
            optimizedPath[stairEndIdx],
            originalPath,
          )
        ) {
          continue
        }

        const startPoint = optimizedPath[startIdx]
        const endPoint = optimizedPath[stairEndIdx]

        const connectionOptions = tryConnectPoints(startPoint, endPoint)

        for (const connection of connectionOptions) {
          const testPath = [
            ...optimizedPath.slice(0, startIdx + 1),
            ...connection.slice(1, -1),
            ...optimizedPath.slice(stairEndIdx),
          ]

          const collidesWithObstacles = hasCollisions(connection, obstacles)
          const collidesWithLabels = hasCollisionsWithLabels(
            connection,
            labelBounds,
          )

          if (!collidesWithObstacles && !collidesWithLabels) {
            const newTurns = countTurns(testPath)
            optimizedPath = testPath
            currentTurns = newTurns
            improved = true
            break
          }
        }

        if (improved) break
      }
    }

    // If no stair-step optimization worked, try regular point removal
    if (!improved) {
      for (let startIdx = 0; startIdx < optimizedPath.length - 2; startIdx++) {
        const maxRemove = Math.min(
          optimizedPath.length - startIdx - 2,
          optimizedPath.length - 2,
        )

        for (let removeCount = 1; removeCount <= maxRemove; removeCount++) {
          const endIdx = startIdx + removeCount + 1

          if (endIdx >= optimizedPath.length) continue

          if (
            isSegmentAnEndpointSegment(
              optimizedPath[startIdx],
              optimizedPath[startIdx + 1],
              originalPath,
            ) ||
            isSegmentAnEndpointSegment(
              optimizedPath[endIdx - 1],
              optimizedPath[endIdx],
              originalPath,
            )
          ) {
            continue
          }

          const startPoint = optimizedPath[startIdx]
          const endPoint = optimizedPath[endIdx]

          const connectionOptions = tryConnectPoints(startPoint, endPoint)

          for (const connection of connectionOptions) {
            const testPath = [
              ...optimizedPath.slice(0, startIdx + 1),
              ...connection.slice(1, -1),
              ...optimizedPath.slice(endIdx),
            ]

            const connectionSegments = connection
            const collidesWithObstacles = hasCollisions(
              connectionSegments,
              obstacles,
            )
            const collidesWithLabels = hasCollisionsWithLabels(
              connectionSegments,
              labelBounds,
            )

            if (!collidesWithObstacles && !collidesWithLabels) {
              const newTurns = countTurns(testPath)

              if (
                newTurns < currentTurns ||
                (newTurns === currentTurns &&
                  testPath.length < optimizedPath.length)
              ) {
                optimizedPath = testPath
                currentTurns = newTurns
                improved = true
                break
              }
            }
          }

          if (improved) break
        }
        if (improved) break
      }
    }

    if (!improved) {
      for (let i = 0; i < optimizedPath.length - 2; i++) {
        const p1 = optimizedPath[i]
        const p2 = optimizedPath[i + 1]
        const p3 = optimizedPath[i + 2]

        if (
          isSegmentAnEndpointSegment(p1, p2, originalPath) ||
          isSegmentAnEndpointSegment(p2, p3, originalPath)
        ) {
          continue
        }

        const allVertical = p1.x === p2.x && p2.x === p3.x
        const allHorizontal = p1.y === p2.y && p2.y === p3.y

        if (allVertical || allHorizontal) {
          const testPath = [
            ...optimizedPath.slice(0, i + 1),
            ...optimizedPath.slice(i + 2),
          ]

          const collidesWithObstacles = hasCollisions([p1, p3], obstacles)
          const collidesWithLabels = hasCollisionsWithLabels(
            [p1, p3],
            labelBounds,
          )

          if (!collidesWithObstacles && !collidesWithLabels) {
            optimizedPath = testPath
            improved = true
            break
          }
        }
      }
    }
  }

  const finalSimplifiedPath = simplifyPath(optimizedPath)
  return finalSimplifiedPath
}
