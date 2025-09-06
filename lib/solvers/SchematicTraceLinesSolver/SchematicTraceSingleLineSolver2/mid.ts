import type { Point } from "@tscircuit/math-utils"
import type { ChipWithBounds } from "./rect"

const EPS = 1e-9

export type Axis = "x" | "y"

export const aabbFromPoints = (a: Point, b: Point) => ({
  minX: Math.min(a.x, b.x),
  maxX: Math.max(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxY: Math.max(a.y, b.y),
})

export const midBetweenPointAndRect = (
  axis: Axis,
  p: Point,
  r: ChipWithBounds,
  eps = EPS,
): number[] => {
  if (axis === "x") {
    if (p.x < r.minX - eps) {
      return [(p.x + r.minX) / 2]
    }
    if (p.x > r.maxX + eps) {
      return [(p.x + r.maxX) / 2]
    }
    // Point is within rect bounds on this axis - generate candidates on both sides
    return [r.minX - 0.2, r.maxX + 0.2]
  } else {
    if (p.y < r.minY - eps) {
      return [(p.y + r.minY) / 2]
    }
    if (p.y > r.maxY + eps) {
      return [(p.y + r.maxY) / 2]
    }
    // Point is within rect bounds on this axis - generate candidates on both sides
    return [r.minY - 0.2, r.maxY + 0.2]
  }
}

export const candidateMidsFromSet = (
  axis: Axis,
  colliding: ChipWithBounds,
  rectsById: Map<string, ChipWithBounds>,
  collisionRectIds: Set<string>,
  aabb: { minX: number; maxX: number; minY: number; maxY: number },
  eps = EPS,
): number[] => {
  const setRects = [...collisionRectIds]
    .map((id) => rectsById.get(id))
    .filter((r): r is ChipWithBounds => !!r)

  if (axis === "x") {
    const leftBoundaries = [aabb.minX, ...setRects.map((r) => r.maxX)].filter(
      (v) => v < colliding.minX - eps,
    )
    const rightBoundaries = [aabb.maxX, ...setRects.map((r) => r.minX)].filter(
      (v) => v > colliding.maxX + eps,
    )

    const leftNeighbor =
      leftBoundaries.length > 0 ? Math.max(...leftBoundaries) : undefined
    const rightNeighbor =
      rightBoundaries.length > 0 ? Math.min(...rightBoundaries) : undefined

    const out: number[] = []
    if (leftNeighbor !== undefined) {
      out.push((leftNeighbor + colliding.minX) / 2)
    }
    if (rightNeighbor !== undefined) {
      out.push((colliding.maxX + rightNeighbor) / 2)
    }
    return out
  } else {
    const bottomBoundaries = [aabb.minY, ...setRects.map((r) => r.maxY)].filter(
      (v) => v < colliding.minY - eps,
    )
    const topBoundaries = [aabb.maxY, ...setRects.map((r) => r.minY)].filter(
      (v) => v > colliding.maxY + eps,
    )

    const bottomNeighbor =
      bottomBoundaries.length > 0 ? Math.max(...bottomBoundaries) : undefined
    const topNeighbor =
      topBoundaries.length > 0 ? Math.min(...topBoundaries) : undefined

    const out: number[] = []
    if (bottomNeighbor !== undefined) {
      out.push((bottomNeighbor + colliding.minY) / 2)
    }
    if (topNeighbor !== undefined) {
      out.push((colliding.maxY + topNeighbor) / 2)
    }
    return out
  }
}
