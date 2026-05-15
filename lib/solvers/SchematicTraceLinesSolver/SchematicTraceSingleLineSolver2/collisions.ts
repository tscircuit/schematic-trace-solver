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
  thickness = 0,
): boolean => {
  const vert = isVertical(a, b, eps)
  const horz = isHorizontal(a, b, eps)
  if (!vert && !horz) return false

  const pad = thickness / 2
  const rMinX = r.minX - pad
  const rMaxX = r.maxX + pad
  const rMinY = r.minY - pad
  const rMaxY = r.maxY + pad

  if (vert) {
    const x = a.x
    if (x < rMinX - eps || x > rMaxX + eps) return false
    const segMinY = Math.min(a.y, b.y)
    const segMaxY = Math.max(a.y, b.y)
    const overlap = Math.min(segMaxY, rMaxY) - Math.max(segMinY, rMinY)
    return overlap > eps
  } else {
    const y = a.y
    if (y < rMinY - eps || y > rMaxY + eps) return false
    const segMinX = Math.min(a.x, b.x)
    const segMaxX = Math.max(a.x, b.x)
    const overlap = Math.min(segMaxX, rMaxX) - Math.max(segMinX, rMinX)
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

/**
 * Checks if a given path has any intersections with a set of chip obstacles.
 */
export const isPathCollidingWithObstacles = (
  path: Point[],
  obstacles: ChipWithBounds[],
): boolean => {
  for (let i = 0; i < path.length - 1; i++) {
    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(path[i], path[i + 1], obstacle)) {
        return true // Found a collision
      }
    }
  }
  return false // No collisions found
}
