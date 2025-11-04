import type { Point } from "@tscircuit/math-utils"

export interface LShape {
  p1: Point
  p2: Point // The corner
  p3: Point
  traceId?: string
}

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
