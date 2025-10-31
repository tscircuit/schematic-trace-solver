import type { Point } from "graphics-debug"
import { hasCollisions } from "./hasCollisions"
import { countTurns } from "./countTurns"
import { simplifyPath } from "./simplifyPath"
import { tryConnectPoints } from "./tryConnectPoints"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"

export const minimizeTurns = ({
  path,
  obstacles,
  labelBounds,
}: {
  path: Point[]
  obstacles: any[]
  labelBounds: any[]
}): Point[] => {
  if (path.length <= 2) {
    return path
  }

  const recognizeStairStepPattern = (
    pathToCheck: Point[],
    startIdx: number,
  ): number => {
    if (startIdx >= pathToCheck.length - 3) return -1

    let endIdx = startIdx
    let isStairStep = true

    for (
      let i = startIdx;
      i < pathToCheck.length - 2 && i < startIdx + 10;
      i++
    ) {
      if (i + 2 >= pathToCheck.length) break

      const p1 = pathToCheck[i]
      const p2 = pathToCheck[i + 1]
      const p3 = pathToCheck[i + 2]

      const seg1Vertical = p1.x === p2.x
      const seg2Vertical = p2.x === p3.x

      if (seg1Vertical === seg2Vertical) {
        break
      }

      const seg1Direction = seg1Vertical
        ? Math.sign(p2.y - p1.y)
        : Math.sign(p2.x - p1.x)

      if (i > startIdx) {
        const prevP = pathToCheck[i - 1]
        const prevSegVertical = prevP.x === p1.x
        const prevDirection = prevSegVertical
          ? Math.sign(p1.y - prevP.y)
          : Math.sign(p1.x - prevP.x)

        if (
          (seg1Vertical &&
            prevSegVertical &&
            seg1Direction !== prevDirection) ||
          (!seg1Vertical && !prevSegVertical && seg1Direction !== prevDirection)
        ) {
          isStairStep = false
          break
        }
      }

      endIdx = i + 2
    }

    return isStairStep && endIdx - startIdx >= 3 ? endIdx : -1
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
