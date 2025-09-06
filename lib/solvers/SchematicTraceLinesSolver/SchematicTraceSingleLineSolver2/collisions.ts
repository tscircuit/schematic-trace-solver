import type { Point } from "@tscircuit/math-utils"
import type { ChipWithBounds } from "./rect"

const EPS = 1e-9

export const isVertical = (a: Point, b: Point, eps = EPS) =>
  Math.abs(a.x - b.x) < eps
export const isHorizontal = (a: Point, b: Point, eps = EPS) =>
  Math.abs(a.y - b.y) < eps

export const segmentIntersectsRect = (
  a: Point,
  b: Point,
  r: ChipWithBounds,
  eps = EPS,
): boolean => {
  const vert = isVertical(a, b, eps)
  const horz = isHorizontal(a, b, eps)
  if (!vert && !horz) return false

  if (vert) {
    const x = a.x
    if (x < r.minX - eps || x > r.maxX + eps) return false
    const segMinY = Math.min(a.y, b.y)
    const segMaxY = Math.max(a.y, b.y)
    const overlap = Math.min(segMaxY, r.maxY) - Math.max(segMinY, r.minY)
    return overlap > eps
  } else {
    const y = a.y
    if (y < r.minY - eps || y > r.maxY + eps) return false
    const segMinX = Math.min(a.x, b.x)
    const segMaxX = Math.max(a.x, b.x)
    const overlap = Math.min(segMaxX, r.maxX) - Math.max(segMinX, r.minX)
    return overlap > eps
  }
}

export const findFirstCollision = (
  pts: Point[],
  rects: ChipWithBounds[],
  opts: {
    excludeRectIdsForSegment?: (segIndex: number) => Set<string>
  } = {},
): { segIndex: number; rect: ChipWithBounds } | null => {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const excluded = opts.excludeRectIdsForSegment?.(i) ?? new Set<string>()
    for (const r of rects) {
      if (excluded.has(r.chipId)) continue
      if (segmentIntersectsRect(a, b, r)) {
        return { segIndex: i, rect: r }
      }
    }
  }
  return null
}
