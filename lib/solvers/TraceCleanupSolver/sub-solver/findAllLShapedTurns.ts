import type { Point } from "@tscircuit/math-utils"

/**
 * Represents an L-shaped turn in a trace path, defined by three consecutive points.
 * p1 and p3 are the endpoints of the L-shape, and p2 is the corner point.
 */
export interface LShape {
  p1: Point
  p2: Point // The corner
  p3: Point
  traceId?: string
}

/**
 * Identifies and returns all L-shaped turns within a given trace path.
 * An L-shaped turn is detected when two consecutive segments are orthogonal (one vertical, one horizontal)
 * and both segments have a minimum length. This function iterates through the trace path,
 * checking every sequence of three points to see if they form an L-shape.
 */
export const findAllLShapedTurns = (tracePath: Point[]): LShape[] => {
  const lShapes: LShape[] = []
  if (tracePath.length < 3) {
    return lShapes
  }

  for (let i = 0; i < tracePath.length - 2; i++) {
    const p1 = tracePath[i]
    const p2 = tracePath[i + 1]
    const p3 = tracePath[i + 2]

    const dx1 = p2.x - p1.x
    const dy1 = p2.y - p1.y
    const dx2 = p3.x - p2.x
    const dy2 = p3.y - p2.y

    // Check for a 90-degree turn (orthogonal segments)
    if (
      ((dx1 === 0 && dy2 === 0 && dy1 !== 0 && dx2 !== 0) || // Vertical then Horizontal
        (dy1 === 0 && dx2 === 0 && dx1 !== 0 && dy2 !== 0)) && // Horizontal then Vertical
      dx1 * dx1 + dy1 * dy1 >= 0.25 && // p1-p2 arm length >= 0.5
      dx2 * dx2 + dy2 * dy2 >= 0.25 // p2-p3 arm length >= 0.5
    ) {
      lShapes.push({ p1, p2, p3 })
    }
  }

  return lShapes
}
