import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPSILON = 1e-6

const isStrictlyBetween = (value: number, first: number, second: number) =>
  value > Math.min(first, second) + EPSILON &&
  value < Math.max(first, second) - EPSILON

const isStrictInteriorPerpendicularCrossing = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  const firstIsHorizontal = Math.abs(firstStart.y - firstEnd.y) <= EPSILON
  const firstIsVertical = Math.abs(firstStart.x - firstEnd.x) <= EPSILON
  const secondIsHorizontal = Math.abs(secondStart.y - secondEnd.y) <= EPSILON
  const secondIsVertical = Math.abs(secondStart.x - secondEnd.x) <= EPSILON

  const horizontalStart = firstIsHorizontal
    ? firstStart
    : secondIsHorizontal
      ? secondStart
      : null
  const horizontalEnd = firstIsHorizontal
    ? firstEnd
    : secondIsHorizontal
      ? secondEnd
      : null
  const verticalStart = firstIsVertical
    ? firstStart
    : secondIsVertical
      ? secondStart
      : null
  const verticalEnd = firstIsVertical
    ? firstEnd
    : secondIsVertical
      ? secondEnd
      : null

  if (!horizontalStart || !horizontalEnd || !verticalStart || !verticalEnd) {
    return false
  }

  return (
    isStrictlyBetween(verticalStart.x, horizontalStart.x, horizontalEnd.x) &&
    isStrictlyBetween(horizontalStart.y, verticalStart.y, verticalEnd.y)
  )
}

/**
 * A recovered schematic trace may cross another trace perpendicularly in the
 * interior of both segments. Shared runs, endpoint contacts, and T-junctions
 * remain conflicts because they can imply connectivity or render ambiguously.
 */
export const doesTraceRecoveryPathConflict = (
  path: Point[],
  traces: SolvedTracePath[],
) => {
  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    const pathStart = path[pathIndex]!
    const pathEnd = path[pathIndex + 1]!

    for (const trace of traces) {
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
          isStrictInteriorPerpendicularCrossing(
            pathStart,
            pathEnd,
            traceStart,
            traceEnd,
          )
        ) {
          continue
        }
        return true
      }
    }
  }

  return false
}
