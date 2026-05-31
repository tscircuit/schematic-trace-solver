import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-6

const sameX = (a: Point, b: Point) => Math.abs(a.x - b.x) <= EPS
const sameY = (a: Point, b: Point) => Math.abs(a.y - b.y) <= EPS

/**
 * Checks if a given path of four points forms a rectangle with horizontal and vertical segments.
 * It verifies if the path forms either an H-V-H "C" shape or a V-H-V "C" shape.
 */
export const is4PointRectangle = (path: Point[]): boolean => {
  if (path.length !== 4) return false
  const [p0, p1, p2, p3] = path
  // H-V-H "C" shape
  const isHVHC =
    sameY(p0, p1) && sameX(p1, p2) && sameY(p2, p3) && sameX(p0, p3)
  // V-H-V "C" shape
  const isVHVC =
    sameX(p0, p1) && sameY(p1, p2) && sameX(p2, p3) && sameY(p0, p3)
  return isHVHC || isVHVC
}
