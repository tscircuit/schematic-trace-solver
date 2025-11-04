import type { Point } from "@tscircuit/math-utils"

export const is4PointRectangle = (path: Point[]): boolean => {
  if (path.length !== 4) return false
  const [p0, p1, p2, p3] = path
  // H-V-H "C" shape
  const isHVHC =
    p0.y === p1.y && p1.x === p2.x && p2.y === p3.y && p0.x === p3.x
  // V-H-V "C" shape
  const isVHVC =
    p0.x === p1.x && p1.y === p2.y && p2.x === p3.x && p0.y === p3.y
  return isHVHC || isVHVC
}
