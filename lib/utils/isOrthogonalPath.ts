import type { Point } from "@tscircuit/math-utils"

/**
 * Check that a polyline consists solely of horizontal or vertical segments.
 *
 * A small tolerance is used to avoid floating point issues when comparing
 * coordinates.
 */
export const isOrthogonalPath = (pts: Point[], eps = 1e-6): boolean => {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const vertical = Math.abs(a.x - b.x) < eps
    const horizontal = Math.abs(a.y - b.y) < eps
    if (!vertical && !horizontal) return false
  }
  return true
}
