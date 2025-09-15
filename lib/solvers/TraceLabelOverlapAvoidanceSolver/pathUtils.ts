import type { Point } from "graphics-debug"
import {
  isVertical,
  isHorizontal,
  segmentIntersectsRect,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const countTurns = (points: Point[]): number => {
  let turns = 0
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const prevVertical = prev.x === curr.x
    const nextVertical = curr.x === next.x

    if (prevVertical !== nextVertical) {
      turns++
    }
  }
  return turns
}

export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 3) return path
  const newPath: Point[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = path[i]
    const p3 = path[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(path[path.length - 1])

  if (newPath.length < 3) return newPath
  const finalPath: Point[] = [newPath[0]]
  for (let i = 1; i < newPath.length - 1; i++) {
    const p1 = finalPath[finalPath.length - 1]
    const p2 = newPath[i]
    const p3 = newPath[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    finalPath.push(p2)
  }
  finalPath.push(newPath[newPath.length - 1])

  return finalPath
}

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
