import type { Point } from "@tscircuit/math-utils"
import { isHorizontal, isVertical } from "./collisions"
import { hasOnlyNonzeroOrthogonalSegments } from "./pathOps"
import type { RectBounds } from "./rect"

const EPS = 1e-9
const DEFAULT_CLEARANCE = 0.2

const isStrictlyBetween = (value: number, a: number, b: number) =>
  value > Math.min(a, b) + EPS && value < Math.max(a, b) - EPS

export const generateInternalSegmentCollisionDetours = ({
  path,
  collidingSegmentIndex,
  obstacle,
  clearance = DEFAULT_CLEARANCE,
}: {
  path: Point[]
  collidingSegmentIndex: number
  obstacle: RectBounds
  clearance?: number
}): Point[][] => {
  if (collidingSegmentIndex <= 0 || collidingSegmentIndex >= path.length - 2) {
    return []
  }

  const start = path[collidingSegmentIndex]!
  const end = path[collidingSegmentIndex + 1]!
  const detourPoints: Point[][] = []

  if (isHorizontal(start, end)) {
    const movingRight = start.x < end.x
    const entryX = movingRight
      ? obstacle.minX - clearance
      : obstacle.maxX + clearance
    const exitX = movingRight
      ? obstacle.maxX + clearance
      : obstacle.minX - clearance

    if (
      !isStrictlyBetween(entryX, start.x, end.x) ||
      !isStrictlyBetween(exitX, start.x, end.x)
    ) {
      return []
    }

    for (const detourY of [
      obstacle.minY - clearance,
      obstacle.maxY + clearance,
    ]) {
      detourPoints.push([
        { x: entryX, y: start.y },
        { x: entryX, y: detourY },
        { x: exitX, y: detourY },
        { x: exitX, y: end.y },
      ])
    }
  } else if (isVertical(start, end)) {
    const movingUp = start.y < end.y
    const entryY = movingUp
      ? obstacle.minY - clearance
      : obstacle.maxY + clearance
    const exitY = movingUp
      ? obstacle.maxY + clearance
      : obstacle.minY - clearance

    if (
      !isStrictlyBetween(entryY, start.y, end.y) ||
      !isStrictlyBetween(exitY, start.y, end.y)
    ) {
      return []
    }

    for (const detourX of [
      obstacle.minX - clearance,
      obstacle.maxX + clearance,
    ]) {
      detourPoints.push([
        { x: start.x, y: entryY },
        { x: detourX, y: entryY },
        { x: detourX, y: exitY },
        { x: end.x, y: exitY },
      ])
    }
  }

  return detourPoints
    .map((points) => [
      ...path.slice(0, collidingSegmentIndex + 1),
      ...points,
      ...path.slice(collidingSegmentIndex + 1),
    ])
    .filter(hasOnlyNonzeroOrthogonalSegments)
}
