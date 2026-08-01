import type { Point } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { countTurns } from "./countTurns"

export const hasCollisions = (
  pathSegments: Point[],
  obstacles: Array<{ minX: number; maxX: number; minY: number; maxY: number }>,
): boolean => {
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const p1 = pathSegments[i]!
    const p2 = pathSegments[i + 1]!
    for (const obstacle of obstacles) {
      const box = {
        minX: obstacle.minX,
        maxX: obstacle.maxX,
        minY: obstacle.minY,
        maxY: obstacle.maxY,
      }
      if (segmentIntersectsRect(p1, p2, box)) {
        return true
      }
    }
  }
  return false
}

export const hasCollisionsWithLabels = (
  pathSegments: Point[],
  labels: Array<{ minX: number; maxX: number; minY: number; maxY: number }>,
): boolean => {
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const p1 = pathSegments[i]!
    const p2 = pathSegments[i + 1]!
    for (const label of labels) {
      if (segmentIntersectsRect(p1, p2, label)) {
        return true
      }
    }
  }
  return false
}

export const tryConnectPoints = (start: Point, end: Point): Point[][] => {
  const candidates: Point[][] = []
  if (start.x === end.x || start.y === end.y) {
    candidates.push([start, end])
  } else {
    candidates.push([start, { x: end.x, y: start.y }, end])
    candidates.push([start, { x: start.x, y: end.y }, end])
  }
  return candidates
}

export const recognizeStairStepPattern = (
  pathToCheck: Point[],
  startIdx: number,
): number => {
  if (startIdx >= pathToCheck.length - 3) return -1

  let endIdx = startIdx
  let isStairStep = true

  for (let i = startIdx; i < pathToCheck.length - 2 && i < startIdx + 10; i++) {
    if (i + 2 >= pathToCheck.length) break
    const p1 = pathToCheck[i]!
    const p2 = pathToCheck[i + 1]!
    const p3 = pathToCheck[i + 2]!

    const seg1Vertical = p1.x === p2.x
    const seg2Vertical = p2.x === p3.x
    if (seg1Vertical === seg2Vertical) break

    const seg1Direction = seg1Vertical
      ? Math.sign(p2.y - p1.y)
      : Math.sign(p2.x - p1.x)

    if (i > startIdx) {
      const prevP = pathToCheck[i - 1]!
      const prevSegVertical = prevP.x === p1.x
      const prevDirection = prevSegVertical
        ? Math.sign(p1.y - prevP.y)
        : Math.sign(p1.x - prevP.x)

      if (
        (seg1Vertical && prevSegVertical && seg1Direction !== prevDirection) ||
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

export const isSegmentAnEndpointSegment = (
  p1: Point,
  p2: Point,
  originalPath: Point[],
): boolean => {
  if (originalPath.length < 2) return false
  const originalStart = originalPath[0]!
  const originalEnd = originalPath[originalPath.length - 1]!
  if (
    p1.x === originalStart.x &&
    p1.y === originalStart.y &&
    p2.x === originalPath[1]!.x &&
    p2.y === originalPath[1]!.y
  ) {
    return true
  }
  if (
    p1.x === originalPath[originalPath.length - 2]!.x &&
    p1.y === originalPath[originalPath.length - 2]!.y &&
    p2.x === originalEnd.x &&
    p2.y === originalEnd.y
  ) {
    return true
  }
  return false
}

export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 3) return path
  const newPath: Point[] = [path[0]!]
  for (let i = 1; i < path.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]!
    const p2 = path[i]!
    const p3 = path[i + 1]!
    const isVerticalP12 = Math.abs(p1.x - p2.x) < 1e-9
    const isVerticalP23 = Math.abs(p2.x - p3.x) < 1e-9
    const isHorizontalP12 = Math.abs(p1.y - p2.y) < 1e-9
    const isHorizontalP23 = Math.abs(p2.y - p3.y) < 1e-9
    if ((isVerticalP12 && isVerticalP23) || (isHorizontalP12 && isHorizontalP23)) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(path[path.length - 1]!)

  if (newPath.length < 3) return newPath
  const finalPath: Point[] = [newPath[0]!]
  for (let i = 1; i < newPath.length - 1; i++) {
    const p1 = finalPath[finalPath.length - 1]!
    const p2 = newPath[i]!
    const p3 = newPath[i + 1]!
    const isVerticalP12 = Math.abs(p1.x - p2.x) < 1e-9
    const isVerticalP23 = Math.abs(p2.x - p3.x) < 1e-9
    const isHorizontalP12 = Math.abs(p1.y - p2.y) < 1e-9
    const isHorizontalP23 = Math.abs(p2.y - p3.y) < 1e-9
    if ((isVerticalP12 && isVerticalP23) || (isHorizontalP12 && isHorizontalP23)) {
      continue
    }
    finalPath.push(p2)
  }
  finalPath.push(newPath[newPath.length - 1]!)
  return finalPath
}

export const minimizeTurnsWithHelpers = (
  path: Point[],
  obstacles: Array<{ minX: number; maxX: number; minY: number; maxY: number }>,
  labelBounds: Array<{ minX: number; maxX: number; minY: number; maxY: number }>,
  originalPath: Point[],
): Point[] => {
  if (path.length <= 2) return path

  let optimizedPath = [...path]
  let currentTurns = countTurns(optimizedPath)
  let improved = true

  while (improved) {
    improved = false

    for (let startIdx = 0; startIdx < optimizedPath.length - 3; startIdx++) {
      const stairEndIdx = recognizeStairStepPattern(optimizedPath, startIdx)
      if (stairEndIdx > 0) {
        if (
          isSegmentAnEndpointSegment(
            optimizedPath[startIdx]!,
            optimizedPath[startIdx + 1]!,
            originalPath,
          ) ||
          isSegmentAnEndpointSegment(
            optimizedPath[stairEndIdx - 1]!,
            optimizedPath[stairEndIdx]!,
            originalPath,
          )
        ) {
          continue
        }

        const startPoint = optimizedPath[startIdx]!
        const endPoint = optimizedPath[stairEndIdx]!
        const connectionOptions = tryConnectPoints(startPoint, endPoint)
        for (const connection of connectionOptions) {
          const testPath = [
            ...optimizedPath.slice(0, startIdx + 1),
            ...connection.slice(1, -1),
            ...optimizedPath.slice(stairEndIdx),
          ]
          const collidesWithObstacles = hasCollisions(connection, obstacles)
          const collidesWithLabels = hasCollisionsWithLabels(connection, labelBounds)
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
              optimizedPath[startIdx]!,
              optimizedPath[startIdx + 1]!,
              originalPath,
            ) ||
            isSegmentAnEndpointSegment(
              optimizedPath[endIdx - 1]!,
              optimizedPath[endIdx]!,
              originalPath,
            )
          ) {
            continue
          }

          const startPoint = optimizedPath[startIdx]!
          const endPoint = optimizedPath[endIdx]!
          const connectionOptions = tryConnectPoints(startPoint, endPoint)
          for (const connection of connectionOptions) {
            const testPath = [
              ...optimizedPath.slice(0, startIdx + 1),
              ...connection.slice(1, -1),
              ...optimizedPath.slice(endIdx),
            ]
            const collidesWithObstacles = hasCollisions(connection, obstacles)
            const collidesWithLabels = hasCollisionsWithLabels(connection, labelBounds)
            if (!collidesWithObstacles && !collidesWithLabels) {
              const newTurns = countTurns(testPath)
              if (
                newTurns < currentTurns ||
                (newTurns === currentTurns && testPath.length < optimizedPath.length)
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
        const p1 = optimizedPath[i]!
        const p2 = optimizedPath[i + 1]!
        const p3 = optimizedPath[i + 2]!
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
          const collidesWithLabels = hasCollisionsWithLabels([p1, p3], labelBounds)
          if (!collidesWithObstacles && !collidesWithLabels) {
            optimizedPath = testPath
            improved = true
            break
          }
        }
      }
    }
  }

  return simplifyPath(optimizedPath)
}
