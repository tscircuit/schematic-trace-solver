import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 1e-9

const isSamePoint = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

/**
 * Removes duplicate consecutive points from a path.
 */
const removeDuplicateConsecutivePoints = (path: Point[]): Point[] => {
  if (path.length < 2) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    if (!isSamePoint(result[result.length - 1], path[i])) {
      result.push(path[i])
    }
  }
  return result
}

export const simplifyPath = (path: Point[]): Point[] => {
  const dedupedPath = removeDuplicateConsecutivePoints(path)
  if (dedupedPath.length < 3) return dedupedPath
  const newPath: Point[] = [dedupedPath[0]]
  for (let i = 1; i < dedupedPath.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = dedupedPath[i]
    const p3 = dedupedPath[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(dedupedPath[dedupedPath.length - 1])

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
