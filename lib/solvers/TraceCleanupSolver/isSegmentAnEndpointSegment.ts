import type { Point } from "graphics-debug"

/**
 * Determines if a given segment (p1-p2) is either the first or the last segment of an original path.
 * This is useful for identifying segments that are at the extremities of a trace.
 */
export const isSegmentAnEndpointSegment = (
  p1: Point,
  p2: Point,
  originalPath: Point[],
): boolean => {
  if (originalPath.length < 2) return false

  const originalStart = originalPath[0]
  const originalEnd = originalPath[originalPath.length - 1]

  // Check if p1-p2 is the first segment of the original path
  if (
    p1.x === originalStart.x &&
    p1.y === originalStart.y &&
    p2.x === originalPath[1].x &&
    p2.y === originalPath[1].y
  ) {
    return true
  }
  // Check if p1-p2 is the last segment of the original path
  if (
    p1.x === originalPath[originalPath.length - 2].x &&
    p1.y === originalPath[originalPath.length - 2].y &&
    p2.x === originalEnd.x &&
    p2.y === originalEnd.y
  ) {
    return true
  }
  return false
}
