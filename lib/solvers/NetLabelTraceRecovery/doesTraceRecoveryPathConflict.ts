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

  const horizontalStart = firstIsHorizontal
    ? firstSegmentStart
    : secondIsHorizontal
      ? secondSegmentStart
      : null
  const horizontalEnd = firstIsHorizontal
    ? firstSegmentEnd
    : secondIsHorizontal
      ? secondSegmentEnd
      : null
  const verticalStart = firstIsVertical
    ? firstSegmentStart
    : secondIsVertical
      ? secondSegmentStart
      : null
  const verticalEnd = firstIsVertical
    ? firstSegmentEnd
    : secondIsVertical
      ? secondSegmentEnd
      : null

  if (!horizontalStart || !horizontalEnd || !verticalStart || !verticalEnd) {
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

/**
 * A recovered schematic trace may cross another trace perpendicularly in the
 * interior of both segments. Shared runs, endpoint contacts, and T-junctions
 * remain conflicts because they can imply connectivity or render ambiguously.
 */
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
