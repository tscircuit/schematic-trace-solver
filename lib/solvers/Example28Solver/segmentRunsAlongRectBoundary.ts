import type { Point } from "@tscircuit/math-utils"
import type { ChipObstacle } from "./types"
import { EPS } from "./types"

export const segmentRunsAlongRectBoundary = (
  start: Point,
  end: Point,
  rect: ChipObstacle,
) => {
  const isVertical = Math.abs(start.x - end.x) < EPS
  const isHorizontal = Math.abs(start.y - end.y) < EPS

  if (isVertical) {
    return (
      Math.abs(start.x - rect.minX) < EPS || Math.abs(start.x - rect.maxX) < EPS
    )
  }

  if (isHorizontal) {
    return (
      Math.abs(start.y - rect.minY) < EPS || Math.abs(start.y - rect.maxY) < EPS
    )
  }

  return false
}
