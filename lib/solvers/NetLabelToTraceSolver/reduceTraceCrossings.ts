import type { Point } from "@tscircuit/math-utils"
import {
  countPathIntersections,
  getPathLength,
  segmentsIntersect,
} from "lib/solvers/Example28Solver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-9

const isHorizontal = (start: Point, end: Point) =>
  Math.abs(start.y - end.y) < EPS

const isVertical = (start: Point, end: Point) => Math.abs(start.x - end.x) < EPS

const compactConsecutivePoints = (path: Point[]) =>
  path.filter((point, index) => {
    const previousPoint = path[index - 1]
    return (
      !previousPoint ||
      Math.abs(point.x - previousPoint.x) >= EPS ||
      Math.abs(point.y - previousPoint.y) >= EPS
    )
  })

const isValidOrthogonalPath = (path: Point[]) => {
  if (
    path.length < 2 ||
    !path.every((point, index) => {
      const nextPoint = path[index + 1]
      if (!nextPoint) return true
      return isHorizontal(point, nextPoint) || isVertical(point, nextPoint)
    })
  ) {
    return false
  }

  for (
    let firstSegmentIndex = 0;
    firstSegmentIndex < path.length - 1;
    firstSegmentIndex++
  ) {
    for (
      let secondSegmentIndex = firstSegmentIndex + 2;
      secondSegmentIndex < path.length - 1;
      secondSegmentIndex++
    ) {
      if (
        segmentsIntersect(
          path[firstSegmentIndex]!,
          path[firstSegmentIndex + 1]!,
          path[secondSegmentIndex]!,
          path[secondSegmentIndex + 1]!,
        )
      ) {
        return false
      }
    }
  }

  return true
}

const getEndpointAlignedSegmentCandidates = (tracePath: Point[]) => {
  const candidates: Point[][] = []

  // Preserve the terminal segment at each pin. For an interior segment whose
  // neighboring segments are perpendicular, align it with either neighboring
  // endpoint corridor. This keeps the same orthogonal topology while allowing
  // a midpoint elbow to move away from avoidable trace crossings.
  for (
    let segmentIndex = 2;
    segmentIndex <= tracePath.length - 4;
    segmentIndex++
  ) {
    const previousPoint = tracePath[segmentIndex - 1]!
    const start = tracePath[segmentIndex]!
    const end = tracePath[segmentIndex + 1]!
    const nextPoint = tracePath[segmentIndex + 2]!
    const segmentIsVertical = isVertical(start, end)
    const segmentIsHorizontal = isHorizontal(start, end)

    if (
      (!segmentIsVertical && !segmentIsHorizontal) ||
      (segmentIsVertical &&
        (!isHorizontal(previousPoint, start) ||
          !isHorizontal(end, nextPoint))) ||
      (segmentIsHorizontal &&
        (!isVertical(previousPoint, start) || !isVertical(end, nextPoint)))
    ) {
      continue
    }

    const alignedCoordinates = segmentIsVertical
      ? [previousPoint.x, nextPoint.x]
      : [previousPoint.y, nextPoint.y]
    for (const alignedCoordinate of alignedCoordinates) {
      if (
        Math.abs(alignedCoordinate - (segmentIsVertical ? start.x : start.y)) <
        EPS
      ) {
        continue
      }

      const candidate = tracePath.map((point) => ({ ...point }))
      if (segmentIsVertical) {
        candidate[segmentIndex]!.x = alignedCoordinate
        candidate[segmentIndex + 1]!.x = alignedCoordinate
      } else {
        candidate[segmentIndex]!.y = alignedCoordinate
        candidate[segmentIndex + 1]!.y = alignedCoordinate
      }

      const compactedCandidate = compactConsecutivePoints(candidate)
      if (isValidOrthogonalPath(compactedCandidate)) {
        candidates.push(compactedCandidate)
      }
    }
  }

  return candidates
}

const countOtherNetCrossings = ({
  tracePath,
  globalConnNetId,
  otherTraces,
}: {
  tracePath: Point[]
  globalConnNetId: string
  otherTraces: SolvedTracePath[]
}) =>
  otherTraces.reduce(
    (crossingCount, otherTrace) =>
      crossingCount +
      (otherTrace.globalConnNetId === globalConnNetId
        ? 0
        : countPathIntersections(tracePath, otherTrace.tracePath)),
    0,
  )

export const reduceTraceCrossings = ({
  tracePath,
  globalConnNetId,
  otherTraces,
  isCandidateValid,
}: {
  tracePath: Point[]
  globalConnNetId: string
  otherTraces: SolvedTracePath[]
  isCandidateValid: (candidate: Point[]) => boolean
}) => {
  let bestPath = tracePath
  let bestCrossingCount = countOtherNetCrossings({
    tracePath,
    globalConnNetId,
    otherTraces,
  })
  let bestPathLength = getPathLength(tracePath)

  for (const candidate of getEndpointAlignedSegmentCandidates(tracePath)) {
    if (!isCandidateValid(candidate)) continue
    const crossingCount = countOtherNetCrossings({
      tracePath: candidate,
      globalConnNetId,
      otherTraces,
    })
    const pathLength = getPathLength(candidate)
    if (
      crossingCount < bestCrossingCount ||
      (crossingCount === bestCrossingCount && pathLength < bestPathLength)
    ) {
      bestPath = candidate
      bestCrossingCount = crossingCount
      bestPathLength = pathLength
    }
  }

  return bestPath
}
