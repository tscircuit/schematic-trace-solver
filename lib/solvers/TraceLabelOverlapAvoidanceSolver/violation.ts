import type { Point } from "@tscircuit/math-utils"

export const findTraceViolationZone = (
  path: Point[],
  labelBounds: { minX: number; maxX: number; minY: number; maxY: number },
) => {
  const isPointInside = (p: Point) =>
    p.x > labelBounds.minX &&
    p.x < labelBounds.maxX &&
    p.y > labelBounds.minY &&
    p.y < labelBounds.maxY

  let firstInsideIndex = -1
  let lastInsideIndex = -1

  for (let i = 0; i < path.length; i++) {
    if (isPointInside(path[i])) {
      if (firstInsideIndex === -1) {
        firstInsideIndex = i
      }
      lastInsideIndex = i
    }
  }
  return { firstInsideIndex, lastInsideIndex }
}
