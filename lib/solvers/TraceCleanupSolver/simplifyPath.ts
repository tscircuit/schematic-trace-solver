import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 1e-9

/**
 * Remove consecutive duplicate points from a path.
 * Two points are considered duplicates if they are within EPS distance.
 */
export const removeDuplicateConsecutivePoints = (path: Point[]): Point[] => {
  if (path.length < 2) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    if (Math.abs(prev.x - curr.x) > EPS || Math.abs(prev.y - curr.y) > EPS) {
      result.push(curr)
    }
  }
  return result
}

export const simplifyPath = (path: Point[]): Point[] => {
  const deduped = removeDuplicateConsecutivePoints(path)
  if (deduped.length < 3) return deduped
  const newPath: Point[] = [deduped[0]]
  for (let i = 1; i < deduped.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = deduped[i]
    const p3 = deduped[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(deduped[deduped.length - 1])

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
