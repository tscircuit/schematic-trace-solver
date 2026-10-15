import type { Point } from "@tscircuit/math-utils"
import type { RectBounds } from "./rect"

const EPS = 1e-9

/**
 * Segments skewed by less than this are treated as axis-aligned for collision
 * purposes. Real schematic geometry is on a 0.001-ish grid, so anything under
 * this is float noise or an off-grid pin, never a deliberate diagonal.
 */
const NEARLY_AXIS_ALIGNED_TOLERANCE = 1e-3

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
    // A segment can miss both fast paths while still being an intended
    // axis-aligned run: a pin whose coordinate sits a few 1e-5 off the routing
    // grid is enough. Treating those as "no collision" let traces pass straight
    // through a chip body, so classify by the dominant axis instead.
    const dx = Math.abs(a.x - b.x)
    const dy = Math.abs(a.y - b.y)
    if (dx < NEARLY_AXIS_ALIGNED_TOLERANCE && dx < dy) {
      return segmentIntersectsRect(
        { x: a.x, y: a.y },
        { x: a.x, y: b.y },
        r,
        eps,
      )
    }
    if (dy < NEARLY_AXIS_ALIGNED_TOLERANCE && dy < dx) {
      return segmentIntersectsRect(
        { x: a.x, y: a.y },
        { x: b.x, y: a.y },
        r,
        eps,
      )
    }
    return false
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
