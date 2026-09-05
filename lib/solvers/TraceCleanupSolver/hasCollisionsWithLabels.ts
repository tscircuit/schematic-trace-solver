import type { Point } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

type LabelBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const EPSILON = 1e-9

const rangesMeetWithoutOverlap = (
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
) =>
  firstMax >= secondMin - EPSILON &&
  secondMax >= firstMin - EPSILON &&
  Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin) <= EPSILON

const pointsEqual = (first: Point, second: Point) =>
  Math.abs(first.x - second.x) <= EPSILON &&
  Math.abs(first.y - second.y) <= EPSILON

const continuesExistingBoundarySegment = ({
  start,
  end,
  label,
  originalPath,
}: {
  start: Point
  end: Point
  label: LabelBounds
  originalPath: Point[]
}) => {
  const isVertical = Math.abs(start.x - end.x) <= EPSILON
  const isHorizontal = Math.abs(start.y - end.y) <= EPSILON
  const isOnBoundary = isVertical
    ? Math.abs(start.x - label.minX) <= EPSILON ||
      Math.abs(start.x - label.maxX) <= EPSILON
    : isHorizontal
      ? Math.abs(start.y - label.minY) <= EPSILON ||
        Math.abs(start.y - label.maxY) <= EPSILON
      : false

  if (!isOnBoundary) return false

  for (let i = 0; i < originalPath.length - 1; i++) {
    const isEndpointSegment = i === 0 || i === originalPath.length - 2
    if (!isEndpointSegment) continue

    const originalStart = originalPath[i]!
    const originalEnd = originalPath[i + 1]!
    const innerEndpoint = i === 0 ? originalEnd : originalStart
    if (
      !pointsEqual(start, innerEndpoint) &&
      !pointsEqual(end, innerEndpoint)
    ) {
      continue
    }
    if (!segmentIntersectsRect(originalStart, originalEnd, label)) continue

    if (
      isVertical &&
      Math.abs(originalStart.x - originalEnd.x) <= EPSILON &&
      Math.abs(originalStart.x - start.x) <= EPSILON &&
      rangesMeetWithoutOverlap(
        Math.min(start.y, end.y),
        Math.max(start.y, end.y),
        Math.min(originalStart.y, originalEnd.y),
        Math.max(originalStart.y, originalEnd.y),
      )
    ) {
      return true
    }

    if (
      isHorizontal &&
      Math.abs(originalStart.y - originalEnd.y) <= EPSILON &&
      Math.abs(originalStart.y - start.y) <= EPSILON &&
      rangesMeetWithoutOverlap(
        Math.min(start.x, end.x),
        Math.max(start.x, end.x),
        Math.min(originalStart.x, originalEnd.x),
        Math.max(originalStart.x, originalEnd.x),
      )
    ) {
      return true
    }
  }

  return false
}

export const hasCollisionsWithLabels = (
  pathSegments: Point[],
  labels: LabelBounds[],
  options: { originalPath?: Point[] } = {},
): boolean => {
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const p1 = pathSegments[i]!
    const p2 = pathSegments[i + 1]!

    for (const label of labels) {
      if (segmentIntersectsRect(p1, p2, label)) {
        if (
          options.originalPath &&
          continuesExistingBoundarySegment({
            start: p1,
            end: p2,
            label,
            originalPath: options.originalPath,
          })
        ) {
          continue
        }
        return true
      }
    }
  }
  return false
}
