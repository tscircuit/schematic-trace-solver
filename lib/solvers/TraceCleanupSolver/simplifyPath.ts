import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const isSamePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y

export const removeDuplicateConsecutivePoints = (path: Point[]): Point[] => {
  if (path.length < 2) return path

  const dedupedPath: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const previousPoint = dedupedPath[dedupedPath.length - 1]
    const currentPoint = path[i]
    if (isSamePoint(previousPoint, currentPoint)) continue
    dedupedPath.push(currentPoint)
  }

  return dedupedPath
}

export const simplifyPath = (path: Point[]): Point[] => {
  const pathWithoutDuplicates = removeDuplicateConsecutivePoints(path)
  if (pathWithoutDuplicates.length < 3) return pathWithoutDuplicates

  const newPath: Point[] = [pathWithoutDuplicates[0]]
  for (let i = 1; i < pathWithoutDuplicates.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = pathWithoutDuplicates[i]
    const p3 = pathWithoutDuplicates[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(pathWithoutDuplicates[pathWithoutDuplicates.length - 1])

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

  return removeDuplicateConsecutivePoints(finalPath)
}
