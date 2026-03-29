import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-9

/**
 * Removes consecutive duplicate points from a path.
 * Two points are considered duplicates if both their x and y coordinates
 * are within EPS of each other.
 */
export function removeDuplicateConsecutivePoints(path: Point[]): Point[] {
  if (path.length <= 1) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    if (Math.abs(prev.x - curr.x) < EPS && Math.abs(prev.y - curr.y) < EPS) {
      continue
    }
    result.push(curr)
  }
  return result
}
