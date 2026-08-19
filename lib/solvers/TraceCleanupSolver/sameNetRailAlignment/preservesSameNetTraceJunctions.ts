import {
  doSegmentsIntersect,
  pointToSegmentDistance,
  type Point,
} from "@tscircuit/math-utils"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { RAIL_ALIGNMENT_EPSILON } from "./geometry"

export const getMinimumDistanceBetweenTracePaths = ({
  firstPath,
  secondPath,
}: {
  firstPath: Point[]
  secondPath: Point[]
}) => {
  let minimumDistance = Number.POSITIVE_INFINITY

  for (
    let firstSegmentIndex = 0;
    firstSegmentIndex < firstPath.length - 1;
    firstSegmentIndex++
  ) {
    const firstStart = firstPath[firstSegmentIndex]!
    const firstEnd = firstPath[firstSegmentIndex + 1]!

    for (
      let secondSegmentIndex = 0;
      secondSegmentIndex < secondPath.length - 1;
      secondSegmentIndex++
    ) {
      const secondStart = secondPath[secondSegmentIndex]!
      const secondEnd = secondPath[secondSegmentIndex + 1]!

      if (doSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return 0
      }

      minimumDistance = Math.min(
        minimumDistance,
        pointToSegmentDistance(firstStart, secondStart, secondEnd),
        pointToSegmentDistance(firstEnd, secondStart, secondEnd),
        pointToSegmentDistance(secondStart, firstStart, firstEnd),
        pointToSegmentDistance(secondEnd, firstStart, firstEnd),
      )
    }
  }

  return minimumDistance
}

export const preservesSameNetTraceJunctions = ({
  beforeTraces,
  afterTraces,
  movedTraceIds,
}: {
  beforeTraces: SolvedTracePath[]
  afterTraces: SolvedTracePath[]
  movedTraceIds: ReadonlySet<MspConnectionPairId>
}) => {
  for (
    let firstTraceIndex = 0;
    firstTraceIndex < beforeTraces.length;
    firstTraceIndex++
  ) {
    const firstTraceBefore = beforeTraces[firstTraceIndex]!

    for (
      let secondTraceIndex = firstTraceIndex + 1;
      secondTraceIndex < beforeTraces.length;
      secondTraceIndex++
    ) {
      const secondTraceBefore = beforeTraces[secondTraceIndex]!
      const firstTraceMoves = movedTraceIds.has(firstTraceBefore.mspPairId)
      const secondTraceMoves = movedTraceIds.has(secondTraceBefore.mspPairId)
      if (!firstTraceMoves && !secondTraceMoves) continue
      if (
        firstTraceBefore.globalConnNetId !== secondTraceBefore.globalConnNetId
      ) {
        continue
      }

      const distanceBefore = getMinimumDistanceBetweenTracePaths({
        firstPath: firstTraceBefore.tracePath,
        secondPath: secondTraceBefore.tracePath,
      })
      if (distanceBefore > RAIL_ALIGNMENT_EPSILON) continue

      const firstTraceAfter = afterTraces.find(
        (trace) => trace.mspPairId === firstTraceBefore.mspPairId,
      )
      const secondTraceAfter = afterTraces.find(
        (trace) => trace.mspPairId === secondTraceBefore.mspPairId,
      )
      if (!firstTraceAfter || !secondTraceAfter) return false

      const distanceAfter = getMinimumDistanceBetweenTracePaths({
        firstPath: firstTraceAfter.tracePath,
        secondPath: secondTraceAfter.tracePath,
      })
      if (distanceAfter > RAIL_ALIGNMENT_EPSILON) return false
    }
  }

  return true
}
