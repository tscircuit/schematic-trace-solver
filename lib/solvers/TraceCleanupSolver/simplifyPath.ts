import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

/**
 * Removes duplicate consecutive points (zero-length segments) from a path.
 * This is useful when UntangleTraceSubsolver introduces redundant points
 * at path-concatenation junctions.
 */
export const removeDuplicateConsecutivePoints = (path: Point[]): Point[] => {
  if (path.length < 2) return path

  const result: Point[] = [path[0]!]
  for (let i = 1; i < path.length; i++) {
    const last = result[result.length - 1]!
    const curr = path[i]!
    // Check if points are effectively the same
    const dx = Math.abs(curr.x - last.x)
    const dy = Math.abs(curr.y - last.y)
    if (dx > 0.0001 || dy > 0.0001) {
      result.push(curr)
    }
  }
  return result
}

export const simplifyPath = (path: Point[]): Point[] => {
  // First remove any duplicate consecutive points
  let processedPath = removeDuplicateConsecutivePoints(path)

  if (processedPath.length < 3) return processedPath

  const newPath: Point[] = [processedPath[0]]
  for (let i = 1; i < processedPath.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = processedPath[i]
    const p3 = processedPath[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(processedPath[processedPath.length - 1])

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
