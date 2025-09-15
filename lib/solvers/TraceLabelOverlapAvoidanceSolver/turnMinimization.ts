import type { Point } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { countTurns, hasCollisions, simplifyPath } from "./pathUtils"

const minimizeTurns = ({
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

  const hasCollisionsWithLabels = (
    pathSegments: Point[],
    labels: any[],
  ): boolean => {
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const p1 = pathSegments[i]
      const p2 = pathSegments[i + 1]

      for (const label of labels) {
        if (segmentIntersectsRect(p1, p2, label)) {
          return true
        }
      }
    }
    return false
  }

  const tryConnectPoints = (start: Point, end: Point): Point[][] => {
    const candidates: Point[][] = []

    if (start.x === end.x || start.y === end.y) {
      candidates.push([start, end])
    } else {
      candidates.push([start, { x: end.x, y: start.y }, end])
      candidates.push([start, { x: start.x, y: end.y }, end])
    }

    return candidates
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
            const turnsRemoved = stairEndIdx - startIdx - 1

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

export const minimizeTurnsWithFilteredLabels = ({
  traces,
  problem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  traces: SolvedTracePath[]
  problem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Map<string, Set<string>>
  paddingBuffer: number
}): SolvedTracePath[] | null => {
  let changesMade = false
  const obstacles = getObstacleRects(problem)

  const newTraces = traces.map((trace) => {
    const originalPath = trace.tracePath
    const filteredLabels = allLabelPlacements.filter((label) => {
      const originalNetIds = mergedLabelNetIdMap.get(label.globalConnNetId)
      if (originalNetIds) {
        return !originalNetIds.has(trace.globalConnNetId)
      }
      return label.globalConnNetId !== trace.globalConnNetId
    })

    const labelBounds = filteredLabels.map((nl) => ({
      minX: nl.center.x - nl.width / 2 - paddingBuffer,
      maxX: nl.center.x + nl.width / 2 + paddingBuffer,
      minY: nl.center.y - nl.height / 2 - paddingBuffer,
      maxY: nl.center.y + nl.height / 2 + paddingBuffer,
    }))

    const newPath = minimizeTurns({
      path: originalPath,
      obstacles,
      labelBounds,
    })

    if (
      newPath.length !== originalPath.length ||
      newPath.some(
        (p, i) => p.x !== originalPath[i].x || p.y !== originalPath[i].y,
      )
    ) {
      changesMade = true
    }

    return {
      ...trace,
      tracePath: newPath,
    }
  })

  if (changesMade) {
    return newTraces
  } else {
    return null
  }
}
