import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const pointsEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y

export const removeConsecutiveDuplicatePoints = (path: Point[]): Point[] => {
  const dedupedPath: Point[] = []

  for (const point of path) {
    const previousPoint = dedupedPath[dedupedPath.length - 1]
    if (!previousPoint || !pointsEqual(previousPoint, point)) {
      dedupedPath.push(point)
    }
  }

  return dedupedPath
}

const collapseCollinearPoints = (path: Point[]): Point[] => {
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

  return newPath
}

export const simplifyPath = (path: Point[]): Point[] => {
  let simplifiedPath = removeConsecutiveDuplicatePoints(path)

  while (simplifiedPath.length >= 3) {
    const nextPath = removeConsecutiveDuplicatePoints(
      collapseCollinearPoints(simplifiedPath),
    )

    if (nextPath.length === simplifiedPath.length) {
      return nextPath
    }

    simplifiedPath = nextPath
  }

  return simplifiedPath
}
