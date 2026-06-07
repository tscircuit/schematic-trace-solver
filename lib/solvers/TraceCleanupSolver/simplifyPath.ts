import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

export const removeDuplicateConsecutivePoints = (
  points: { x: number; y: number }[],
): { x: number; y: number }[] => {
  if (points.length === 0) return points
  const result: { x: number; y: number }[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]
    const curr = points[i]
    if (curr.x !== prev.x || curr.y !== prev.y) {
      result.push(curr)
    }
  }
  return result
}

export const simplifyPath = (path: Point[]): Point[] => {
  path = removeDuplicateConsecutivePoints(path) as Point[]
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
