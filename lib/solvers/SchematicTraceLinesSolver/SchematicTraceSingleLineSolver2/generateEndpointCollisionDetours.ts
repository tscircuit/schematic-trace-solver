import type { Point } from "@tscircuit/math-utils"
import { isHorizontal, isVertical } from "./collisions"
import { type Axis, midBetweenPointAndRect } from "./mid"
import type { ObstacleRect } from "./rect"

const getSegmentAxis = (start: Point, end: Point): Axis | null => {
  if (isVertical(start, end)) return "x"
  if (isHorizontal(start, end)) return "y"
  return null
}

const hasOnlyNonzeroOrthogonalSegments = (path: Point[]) =>
  path.every((point, index) => {
    const nextPoint = path[index + 1]
    if (!nextPoint) return true
    if (!isHorizontal(point, nextPoint) && !isVertical(point, nextPoint)) {
      return false
    }
    return Math.abs(point.x - nextPoint.x) + Math.abs(point.y - nextPoint.y) > 0
  })

export const generateEndpointCollisionDetours = ({
  path,
  collidingSegmentIndex,
  obstacle,
}: {
  path: Point[]
  collidingSegmentIndex: number
  obstacle: ObstacleRect
}): Point[][] => {
  // Endpoint detours expand the initial L- and U-shaped elbow candidates.
  // Longer paths have already been expanded and are handled by segment shifts.
  if (path.length < 3 || path.length > 4) return []

  const lastSegmentIndex = path.length - 2
  if (
    collidingSegmentIndex !== 0 &&
    collidingSegmentIndex !== lastSegmentIndex
  ) {
    return []
  }

  const shouldReverse = collidingSegmentIndex === lastSegmentIndex
  const orderedPath = shouldReverse ? [...path].reverse() : path
  const [start, corner, end] = orderedPath
  const firstSegmentAxis = getSegmentAxis(start!, corner!)
  const secondSegmentAxis = getSegmentAxis(corner!, end!)
  if (!firstSegmentAxis || !secondSegmentAxis) return []
  if (firstSegmentAxis === secondSegmentAxis) return []

  const escapeCoordinates = [
    ...midBetweenPointAndRect(secondSegmentAxis, start!, obstacle),
    ...midBetweenPointAndRect(secondSegmentAxis, end!, obstacle),
  ]
  const detourCoordinates = [
    ...midBetweenPointAndRect(firstSegmentAxis, start!, obstacle),
    ...midBetweenPointAndRect(firstSegmentAxis, end!, obstacle),
  ]

  const detours: Point[][] = []
  for (const escapeCoordinate of [...new Set(escapeCoordinates)]) {
    for (const detourCoordinate of [...new Set(detourCoordinates)]) {
      const orderedDetourPrefix =
        firstSegmentAxis === "y"
          ? [
              start!,
              { x: escapeCoordinate, y: start!.y },
              { x: escapeCoordinate, y: detourCoordinate },
              { x: end!.x, y: detourCoordinate },
              end!,
            ]
          : [
              start!,
              { x: start!.x, y: escapeCoordinate },
              { x: detourCoordinate, y: escapeCoordinate },
              { x: detourCoordinate, y: end!.y },
              end!,
            ]

      const orderedDetour = [...orderedDetourPrefix, ...orderedPath.slice(3)]
      const detour = shouldReverse ? orderedDetour.reverse() : orderedDetour
      if (hasOnlyNonzeroOrthogonalSegments(detour)) detours.push(detour)
    }
  }

  return detours
}
