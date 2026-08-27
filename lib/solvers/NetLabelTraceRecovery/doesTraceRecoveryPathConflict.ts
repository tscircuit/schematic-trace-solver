import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPSILON = 1e-6

const isStrictlyBetween = ({
  coordinate,
  segmentStartCoordinate,
  segmentEndCoordinate,
}: {
  coordinate: number
  segmentStartCoordinate: number
  segmentEndCoordinate: number
}) =>
  coordinate >
    Math.min(segmentStartCoordinate, segmentEndCoordinate) + EPSILON &&
  coordinate < Math.max(segmentStartCoordinate, segmentEndCoordinate) - EPSILON

const isStrictInteriorPerpendicularCrossing = ({
  firstSegmentStart,
  firstSegmentEnd,
  secondSegmentStart,
  secondSegmentEnd,
}: {
  firstSegmentStart: Point
  firstSegmentEnd: Point
  secondSegmentStart: Point
  secondSegmentEnd: Point
}) => {
  const firstIsHorizontal =
    Math.abs(firstSegmentStart.y - firstSegmentEnd.y) <= EPSILON
  const firstIsVertical =
    Math.abs(firstSegmentStart.x - firstSegmentEnd.x) <= EPSILON
  const secondIsHorizontal =
    Math.abs(secondSegmentStart.y - secondSegmentEnd.y) <= EPSILON
  const secondIsVertical =
    Math.abs(secondSegmentStart.x - secondSegmentEnd.x) <= EPSILON

  let horizontalStart: Point
  let horizontalEnd: Point
  if (firstIsHorizontal) {
    horizontalStart = firstSegmentStart
    horizontalEnd = firstSegmentEnd
  } else if (secondIsHorizontal) {
    horizontalStart = secondSegmentStart
    horizontalEnd = secondSegmentEnd
  } else {
    return false
  }

  let verticalStart: Point
  let verticalEnd: Point
  if (firstIsVertical) {
    verticalStart = firstSegmentStart
    verticalEnd = firstSegmentEnd
  } else if (secondIsVertical) {
    verticalStart = secondSegmentStart
    verticalEnd = secondSegmentEnd
  } else {
    return false
  }

  return (
    isStrictlyBetween({
      coordinate: verticalStart.x,
      segmentStartCoordinate: horizontalStart.x,
      segmentEndCoordinate: horizontalEnd.x,
    }) &&
    isStrictlyBetween({
      coordinate: horizontalStart.y,
      segmentStartCoordinate: verticalStart.y,
      segmentEndCoordinate: verticalEnd.y,
    })
  )
}

export const doesTraceRecoveryPathConflict = (
  tracePath: Point[],
  collisionTraces: SolvedTracePath[],
) => {
  for (let pathIndex = 0; pathIndex < tracePath.length - 1; pathIndex++) {
    const pathStart = tracePath[pathIndex]!
    const pathEnd = tracePath[pathIndex + 1]!

    for (const trace of collisionTraces) {
      for (
        let traceIndex = 0;
        traceIndex < trace.tracePath.length - 1;
        traceIndex++
      ) {
        const traceStart = trace.tracePath[traceIndex]!
        const traceEnd = trace.tracePath[traceIndex + 1]!
        if (!doSegmentsIntersect(pathStart, pathEnd, traceStart, traceEnd)) {
          continue
        }
        if (
          isStrictInteriorPerpendicularCrossing({
            firstSegmentStart: pathStart,
            firstSegmentEnd: pathEnd,
            secondSegmentStart: traceStart,
            secondSegmentEnd: traceEnd,
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
