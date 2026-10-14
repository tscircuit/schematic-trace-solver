import type { Point } from "@tscircuit/math-utils"
import type { RectBounds } from "./rect"

const EPS = 1e-9

export const isVertical = (a: Point, b: Point, eps = EPS) =>
  Math.abs(a.x - b.x) < eps
export const isHorizontal = (a: Point, b: Point, eps = EPS) =>
  Math.abs(a.y - b.y) < eps

export const segmentIntersectsRect = <TRect extends RectBounds>(
  a: Point,
  b: Point,
  r: TRect,
  eps = EPS,
): boolean => {
  const vert = isVertical(a, b, eps)
  const horz = isHorizontal(a, b, eps)
  if (!vert && !horz) {
    // Near-axis-aligned segments (jittered pin coordinates) previously fell
    // through as collision-free here. Slanted segments must still be tested
    // against the rect instead of being declared collision-free.
    return segmentIntersectsRectSlanted(a, b, r, eps)
  }

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

/**
 * General segment/AABB intersection via slab (Liang-Barsky) clipping.
 * Only used for non-axis-aligned segments; axis-aligned fast paths above
 * keep the historical overlap semantics (strictly inside counts, touching
 * an edge does not).
 */
const segmentIntersectsRectSlanted = <TRect extends RectBounds>(
  a: Point,
  b: Point,
  r: TRect,
  eps = EPS,
): boolean => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let tMin = 0
  let tMax = 1
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) <= eps) return q > eps
    const t = q / p
    if (p < 0) {
      if (t > tMax) return false
      if (t > tMin) tMin = t
    } else {
      if (t < tMin) return false
      if (t < tMax) tMax = t
    }
    return true
  }

  if (!clip(-dx, a.x - r.minX)) return false
  if (!clip(dx, r.maxX - a.x)) return false
  if (!clip(-dy, a.y - r.minY)) return false
  if (!clip(dy, r.maxY - a.y)) return false

  // A degenerate intersection interval (tMin ~= tMax) means the segment
  // merely touches an edge or corner — matching the axis-aligned paths'
  // "touching does not count" semantics, require a real overlap.
  return tMax - tMin > eps
}

export const segmentOverlapsRectBoundary = <TRect extends RectBounds>(
  a: Point,
  b: Point,
  r: TRect,
  eps = EPS,
): boolean => {
  if (isVertical(a, b, eps)) {
    const onVerticalBoundary =
      Math.abs(a.x - r.minX) <= eps || Math.abs(a.x - r.maxX) <= eps
    if (!onVerticalBoundary) return false

    const overlap =
      Math.min(Math.max(a.y, b.y), r.maxY) -
      Math.max(Math.min(a.y, b.y), r.minY)
    return overlap > eps
  }

  if (isHorizontal(a, b, eps)) {
    const onHorizontalBoundary =
      Math.abs(a.y - r.minY) <= eps || Math.abs(a.y - r.maxY) <= eps
    if (!onHorizontalBoundary) return false

    const overlap =
      Math.min(Math.max(a.x, b.x), r.maxX) -
      Math.max(Math.min(a.x, b.x), r.minX)
    return overlap > eps
  }

  return false
}

export const findFirstCollision = <TRect extends RectBounds>(
  pts: Point[],
  rects: TRect[],
  opts: {
    excludeRectsForSegment?: (segIndex: number) => Set<TRect>
  } = {},
): { segIndex: number; rect: TRect } | null => {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const excluded = opts.excludeRectsForSegment?.(i) ?? new Set<TRect>()
    for (const r of rects) {
      if (excluded.has(r)) continue
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
  obstacles: RectBounds[],
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
