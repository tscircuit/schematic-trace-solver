import type { Point } from "@tscircuit/math-utils"
import { segmentRunsAlongRectBoundary } from "./segmentRunsAlongRectBoundary"
import type { ChipObstacle } from "./types"
import { EPS } from "./types"

export const doesPathRunAlongChipBoundary = (
  path: Point[],
  chipObstacles: ChipObstacle[],
) => {
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    for (const obstacle of chipObstacles) {
      if (!segmentRunsAlongRectBoundary(start, end, obstacle)) continue
      if (getSegmentOverlapWithRectSpan(start, end, obstacle) > EPS) {
        return true
      }
    }
  }
  return false
}

/** Total length of the path that runs along (overlapping) a chip boundary. */
export const getChipBoundaryOverlap = (
  path: Point[],
  chipObstacles: ChipObstacle[],
) => {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    for (const obstacle of chipObstacles) {
      if (!segmentRunsAlongRectBoundary(start, end, obstacle)) continue
      const overlap = getSegmentOverlapWithRectSpan(start, end, obstacle)
      if (overlap > EPS) total += overlap
    }
  }
  return total
}

const getSegmentOverlapWithRectSpan = (
  start: Point,
  end: Point,
  rect: ChipObstacle,
) => {
  const isVertical = Math.abs(start.x - end.x) < EPS

  if (isVertical) {
    return (
      Math.min(Math.max(start.y, end.y), rect.maxY) -
      Math.max(Math.min(start.y, end.y), rect.minY)
    )
  }

  return (
    Math.min(Math.max(start.x, end.x), rect.maxX) -
    Math.max(Math.min(start.x, end.x), rect.minX)
  )
}
