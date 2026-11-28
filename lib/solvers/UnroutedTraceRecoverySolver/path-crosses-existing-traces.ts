import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { PinId } from "lib/types/InputProblem"

const COORDINATE_TOLERANCE = 1e-9

export const pathCrossesExistingTraces = ({
  path,
  connectionPair,
  existingTraces,
}: {
  path: readonly Point[]
  connectionPair: MspConnectionPair
  existingTraces: readonly SolvedTracePath[]
}): boolean => {
  for (const existingTrace of existingTraces) {
    if (existingTrace.globalConnNetId === connectionPair.globalConnNetId) {
      continue
    }
    const existingPinIds = new Set<PinId>(existingTrace.pinIds)
    const allowedJunctionPoints = connectionPair.pins.filter((pin) =>
      existingPinIds.has(pin.pinId),
    )
    for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
      const pathStart = path[pathIndex]
      const pathEnd = path[pathIndex + 1]
      if (!pathStart || !pathEnd) continue
      for (
        let traceIndex = 0;
        traceIndex < existingTrace.tracePath.length - 1;
        traceIndex++
      ) {
        const traceStart = existingTrace.tracePath[traceIndex]
        const traceEnd = existingTrace.tracePath[traceIndex + 1]
        if (
          !traceStart ||
          !traceEnd ||
          !doSegmentsIntersect(pathStart, pathEnd, traceStart, traceEnd)
        ) {
          continue
        }
        const intersectionIsAllowedJunction = allowedJunctionPoints.some(
          (junctionPoint) =>
            ((Math.abs(pathStart.x - junctionPoint.x) <= COORDINATE_TOLERANCE &&
              Math.abs(pathStart.y - junctionPoint.y) <=
                COORDINATE_TOLERANCE) ||
              (Math.abs(pathEnd.x - junctionPoint.x) <= COORDINATE_TOLERANCE &&
                Math.abs(pathEnd.y - junctionPoint.y) <=
                  COORDINATE_TOLERANCE)) &&
            ((Math.abs(traceStart.x - junctionPoint.x) <=
              COORDINATE_TOLERANCE &&
              Math.abs(traceStart.y - junctionPoint.y) <=
                COORDINATE_TOLERANCE) ||
              (Math.abs(traceEnd.x - junctionPoint.x) <= COORDINATE_TOLERANCE &&
                Math.abs(traceEnd.y - junctionPoint.y) <=
                  COORDINATE_TOLERANCE)),
        )
        const horizontalOverlap =
          isHorizontal(pathStart, pathEnd) &&
          isHorizontal(traceStart, traceEnd) &&
          Math.min(
            Math.max(pathStart.x, pathEnd.x),
            Math.max(traceStart.x, traceEnd.x),
          ) -
            Math.max(
              Math.min(pathStart.x, pathEnd.x),
              Math.min(traceStart.x, traceEnd.x),
            ) >
            COORDINATE_TOLERANCE
        const verticalOverlap =
          isVertical(pathStart, pathEnd) &&
          isVertical(traceStart, traceEnd) &&
          Math.min(
            Math.max(pathStart.y, pathEnd.y),
            Math.max(traceStart.y, traceEnd.y),
          ) -
            Math.max(
              Math.min(pathStart.y, pathEnd.y),
              Math.min(traceStart.y, traceEnd.y),
            ) >
            COORDINATE_TOLERANCE
        if (
          intersectionIsAllowedJunction &&
          !horizontalOverlap &&
          !verticalOverlap
        ) {
          continue
        }
        return true
      }
    }
  }
  return false
}
