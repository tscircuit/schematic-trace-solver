import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 1e-9

const removeDuplicateConsecutivePoints = (path: Point[]): Point[] => {
  if (path.length <= 1) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1]
    const cur = path[i]
    if (Math.abs(prev.x - cur.x) < EPS && Math.abs(prev.y - cur.y) < EPS) {
      continue
    }
    result.push(cur)
  }
  return result
}

const collapseCollinearPoints = (path: Point[]): Point[] => {
  if (path.length < 3) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const p1 = result[result.length - 1]
    const p2 = path[i]
    const p3 = path[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    result.push(p2)
  }
  result.push(path[path.length - 1])
  return result
}

export const simplifyPath = (path: Point[]): Point[] => {
  let current = removeDuplicateConsecutivePoints(path)
  current = collapseCollinearPoints(current)
  current = removeDuplicateConsecutivePoints(current)
  current = collapseCollinearPoints(current)
  current = removeDuplicateConsecutivePoints(current)
  return current
}
