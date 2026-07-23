import type { Point } from "@tscircuit/math-utils"
import type { ObstacleRect } from "./rect"

const EPS = 1e-9
const OBSTACLE_CLEARANCE = 0.2

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
  r: ObstacleRect,
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
    return [r.minX - OBSTACLE_CLEARANCE, r.maxX + OBSTACLE_CLEARANCE]
  } else {
    if (p.y < r.minY - eps) {
      return [(p.y + r.minY) / 2]
    }
    if (p.y > r.maxY + eps) {
      return [(p.y + r.maxY) / 2]
    }
    // Point is within rect bounds on this axis - generate candidates on both sides
    return [r.minY - OBSTACLE_CLEARANCE, r.maxY + OBSTACLE_CLEARANCE]
  }
}

export const candidateMidsFromSet = (
  axis: Axis,
  colliding: ObstacleRect,
  collisionRects: Set<ObstacleRect>,
  aabb: { minX: number; maxX: number; minY: number; maxY: number },
  opts: { allowOpenSideCandidates?: boolean; eps?: number } = {},
): number[] => {
  const { allowOpenSideCandidates = false, eps = EPS } = opts
  const setRects = [...collisionRects]

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
    } else if (allowOpenSideCandidates) {
      out.push(colliding.minX - OBSTACLE_CLEARANCE)
    }
    if (rightNeighbor !== undefined) {
      out.push((colliding.maxX + rightNeighbor) / 2)
    } else if (allowOpenSideCandidates) {
      out.push(colliding.maxX + OBSTACLE_CLEARANCE)
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
    } else if (allowOpenSideCandidates) {
      out.push(colliding.minY - OBSTACLE_CLEARANCE)
    }
    if (topNeighbor !== undefined) {
      out.push((colliding.maxY + topNeighbor) / 2)
    } else if (allowOpenSideCandidates) {
      out.push(colliding.maxY + OBSTACLE_CLEARANCE)
    }
    return out
  }
}
