import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const NEAR_ZERO_THRESHOLD = 0.01

/**
 * Removes points that are essentially the same as their neighbor
 * (near-zero-length segments that result from coordinate snapping/merging).
 */
const collapseNearZeroSegments = (path: Point[]): Point[] => {
  if (path.length < 2) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    const dx = Math.abs(curr.x - prev.x)
    const dy = Math.abs(curr.y - prev.y)
    if (dx < NEAR_ZERO_THRESHOLD && dy < NEAR_ZERO_THRESHOLD) {
      // Skip this point as it's essentially the same as the previous one
      continue
    }
    result.push(curr)
  }
  // Ensure we always keep the last point if it was collapsed
  if (result.length >= 1 && path.length >= 1) {
    const last = result[result.length - 1]
    const origLast = path[path.length - 1]
    const dx = Math.abs(origLast.x - last.x)
    const dy = Math.abs(origLast.y - last.y)
    if (dx >= NEAR_ZERO_THRESHOLD || dy >= NEAR_ZERO_THRESHOLD) {
      result.push(origLast)
    }
  }
  return result
}

/**
 * Merges collinear segments (same direction) and collapses near-zero-length
 * segments that may result from snapping/merging nearby parallel traces.
 */
export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 2) return path

  // First pass: collapse near-zero-length segments from snapping
  let working = collapseNearZeroSegments(path)

  if (working.length < 3) return working

  // Second pass: merge collinear segments
  const newPath: Point[] = [working[0]]
  for (let i = 1; i < working.length - 1; i++) {
    const p1 = newPath[newPath.length - 1]
    const p2 = working[i]
    const p3 = working[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    newPath.push(p2)
  }
  newPath.push(working[working.length - 1])

  if (newPath.length < 3) return newPath

  // Third pass: another round of collinear merging to catch any
  // newly-adjacent collinear segments created by near-zero collapse
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

  // Final pass: collapse any remaining near-zero segments
  return collapseNearZeroSegments(finalPath)
}