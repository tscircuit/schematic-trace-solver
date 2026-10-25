import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

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


/**
 * Removes consecutive duplicate points from a trace path.
 * When a route is spliced into an existing path, the concatenation can
 * produce consecutive duplicate points (same x,y) which render as
 * spurious extra trace lines (issue #78).
 */
export const removeDuplicateConsecutivePoints = (
  path: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> => {
  if (path.length <= 1) return path;
  const result: Array<{ x: number; y: number }> = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    if (prev.x !== curr.x || prev.y !== curr.y) {
      result.push(curr);
    }
  }
  return result;
};