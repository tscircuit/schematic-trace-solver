import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import { getDistinctCoordinates, pointsEqual } from "./geometry"
import { moveRailSegments } from "./moveRailSegments"
import { preservesLabelAnchors } from "./preservesLabelAnchors"
import {
  getTraceGeometryMetrics,
  isReadabilityImprovement,
  scoreIsBetter,
} from "./scoreRailAlignment"
import type { AlignmentCandidate, AlignmentScore, RailSegment } from "./types"

interface EvaluateRailGroupInput {
  group: RailSegment[]
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  obstacles: ObstacleRect[]
  eligibleTraceIds: ReadonlySet<string>
}

const tracePathChanged = (
  original: SolvedTracePath,
  candidate: SolvedTracePath,
) =>
  original.tracePath.length !== candidate.tracePath.length ||
  candidate.tracePath.some(
    (point, index) => !pointsEqual(point, original.tracePath[index]!),
  )

export const evaluateRailGroup = ({
  group,
  traces,
  netLabelPlacements,
  obstacles,
  eligibleTraceIds,
}: EvaluateRailGroupInput): AlignmentCandidate | null => {
  const groupTraceIds = new Set(group.map((segment) => segment.traceId))
  const originalGroupTraces = traces.filter((trace) =>
    groupTraceIds.has(trace.mspPairId),
  )
  const baseline = getTraceGeometryMetrics(originalGroupTraces, traces)
  const coordinates = getDistinctCoordinates(
    group.map((segment) => segment.coordinate),
  )
  const otherNetTraces = traces.filter(
    (trace) => trace.globalConnNetId !== group[0]!.globalConnNetId,
  )
  const immutableSameNetTraces = traces.filter(
    (trace) =>
      trace.globalConnNetId === group[0]!.globalConnNetId &&
      !eligibleTraceIds.has(trace.mspPairId),
  )

  let best: AlignmentCandidate | null = null
  for (const coordinate of coordinates) {
    const candidateMap = new Map<string, SolvedTracePath>()

    for (const trace of originalGroupTraces) {
      const candidateTrace = moveRailSegments(
        trace,
        group.filter((segment) => segment.traceId === trace.mspPairId),
        coordinate,
      )
      candidateMap.set(trace.mspPairId, candidateTrace)
    }

    const candidateTraces = [...candidateMap.values()]
    const allCandidateTraces = traces.map(
      (trace) => candidateMap.get(trace.mspPairId) ?? trace,
    )
    const candidatesAreClear = candidateTraces.every(
      (candidate) =>
        !isPathCollidingWithObstacles(candidate.tracePath, obstacles) &&
        detectTraceLabelOverlap({
          traces: [candidate],
          netLabels: netLabelPlacements,
        }).length === 0 &&
        !doesPathCoincideWithTraces(candidate.tracePath, otherNetTraces) &&
        !doesPathCoincideWithTraces(
          candidate.tracePath,
          immutableSameNetTraces.filter(
            (trace) => trace.mspPairId !== candidate.mspPairId,
          ),
        ),
    )
    if (!candidatesAreClear) continue
    if (
      !preservesLabelAnchors(netLabelPlacements, traces, allCandidateTraces)
    ) {
      continue
    }

    const metrics = getTraceGeometryMetrics(candidateTraces, allCandidateTraces)
    if (metrics.otherNetCrossings > baseline.otherNetCrossings) continue
    if (!isReadabilityImprovement(metrics, baseline)) continue

    const score: AlignmentScore = {
      ...metrics,
      displacement: group.reduce(
        (sum, segment) => sum + Math.abs(segment.coordinate - coordinate),
        0,
      ),
      coordinate,
    }
    const changedTraceIds = candidateTraces
      .filter((candidate) => {
        const original = traces.find(
          (trace) => trace.mspPairId === candidate.mspPairId,
        )!
        return tracePathChanged(original, candidate)
      })
      .map((trace) => trace.mspPairId)
    if (changedTraceIds.length === 0) continue

    const candidate = { traces: allCandidateTraces, changedTraceIds, score }
    if (!best || scoreIsBetter(candidate.score, best.score)) best = candidate
  }

  return best
}
