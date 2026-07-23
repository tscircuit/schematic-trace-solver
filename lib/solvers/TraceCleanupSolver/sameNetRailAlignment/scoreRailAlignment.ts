import {
  countPathIntersections,
  getPathLength,
} from "lib/solvers/Example28Solver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { countTurns } from "../countTurns"
import {
  getVisibleTraceLength,
  nearlyEqual,
  RAIL_ALIGNMENT_EPSILON,
} from "./geometry"
import type { AlignmentScore, TraceGeometryMetrics } from "./types"

export const countOtherNetCrossings = (
  traces: SolvedTracePath[],
  allTraces: SolvedTracePath[],
) => {
  let crossings = 0
  for (const trace of traces) {
    for (const otherTrace of allTraces) {
      if (trace.globalConnNetId === otherTrace.globalConnNetId) continue
      crossings += countPathIntersections(trace.tracePath, otherTrace.tracePath)
    }
  }
  return crossings
}

export const getTraceGeometryMetrics = (
  traces: SolvedTracePath[],
  allTraces: SolvedTracePath[],
): TraceGeometryMetrics => ({
  turnCount: traces.reduce(
    (total, trace) => total + countTurns(trace.tracePath),
    0,
  ),
  visibleLength: getVisibleTraceLength(traces),
  pathLength: traces.reduce(
    (sum, trace) => sum + getPathLength(trace.tracePath),
    0,
  ),
  otherNetCrossings: countOtherNetCrossings(traces, allTraces),
})

export const scoreIsBetter = (
  candidate: AlignmentScore,
  best: AlignmentScore,
) => {
  if (candidate.turnCount !== best.turnCount)
    return candidate.turnCount < best.turnCount
  if (!nearlyEqual(candidate.visibleLength, best.visibleLength))
    return candidate.visibleLength < best.visibleLength
  if (!nearlyEqual(candidate.pathLength, best.pathLength))
    return candidate.pathLength < best.pathLength
  if (candidate.otherNetCrossings !== best.otherNetCrossings)
    return candidate.otherNetCrossings < best.otherNetCrossings
  if (!nearlyEqual(candidate.displacement, best.displacement))
    return candidate.displacement < best.displacement
  return candidate.coordinate < best.coordinate
}

export const isReadabilityImprovement = (
  candidate: TraceGeometryMetrics,
  baseline: TraceGeometryMetrics,
) =>
  candidate.turnCount <= baseline.turnCount &&
  (candidate.turnCount < baseline.turnCount ||
    candidate.visibleLength <= baseline.visibleLength + RAIL_ALIGNMENT_EPSILON)
