import type { InputProblem } from "lib/types/InputProblem"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { placeGroundRailLabelsAtOuterEnd } from "lib/solvers/SameNetJunctionAlignmentSolver/placeGroundRailLabelsAtOuterEnd"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathCrossesAnyBounds } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import {
  doesPathCoincideWithTraces,
  doesPathOverlapTraceStrokes,
} from "lib/utils/doesPathCoincideWithTraces"
import { getGroundNetIds } from "lib/utils/getGroundNetIds"
import { getDistinctCoordinates, pointsEqual } from "./geometry"
import { getRailAlignmentFallbackCoordinates } from "./getRailAlignmentFallbackCoordinates"
import { getFixedLabelCoordinate } from "./getFixedLabelCoordinate"
import { moveRailSegments } from "./moveRailSegments"
import { preservesLabelAnchors } from "./preservesLabelAnchors"
import {
  getTraceGeometryMetrics,
  isReadabilityImprovement,
  scoreIsBetter,
} from "./scoreRailAlignment"
import type { AlignmentCandidate, AlignmentScore, RailSegment } from "./types"

interface EvaluateRailGroupInput {
  inputProblem: InputProblem
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
  inputProblem,
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
  const originalCoordinates = getDistinctCoordinates(
    group.map((segment) => segment.coordinate),
  )
  const fixedLabelCoordinate = getFixedLabelCoordinate(
    group,
    netLabelPlacements,
    traces,
  )
  const otherNetTraces = traces.filter(
    (trace) => trace.globalConnNetId !== group[0]!.globalConnNetId,
  )
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const groundNetIds = getGroundNetIds(inputProblem, netConnMap)
  const groundLabelIndices = netLabelPlacements.flatMap((label, index) =>
    label.globalConnNetId === group[0]!.globalConnNetId &&
    groundNetIds.has(label.globalConnNetId)
      ? [index]
      : [],
  )
  const immutableSameNetTraces = traces.filter(
    (trace) =>
      trace.globalConnNetId === group[0]!.globalConnNetId &&
      !eligibleTraceIds.has(trace.mspPairId),
  )

  const evaluateCoordinates = (
    coordinates: number[],
    options?: { coordinateIsFixedByLabel?: boolean },
  ) => {
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
      const placedGroundLabels = groundLabelIndices.length
        ? placeGroundRailLabelsAtOuterEnd({
            inputProblem,
            traces: allCandidateTraces,
            netLabelPlacements,
          })
        : netLabelPlacements
      const groundLabelBounds = groundLabelIndices.map((index) => {
        const label = placedGroundLabels[index]!
        return getRectBounds(label.center, label.width, label.height)
      })
      const candidatesAreClear = candidateTraces.every(
        (candidate) =>
          !isPathCollidingWithObstacles(candidate.tracePath, obstacles) &&
          detectTraceLabelOverlap({
            traces: [candidate],
            netLabels: netLabelPlacements,
          }).length === 0 &&
          // Ground labels may move to the new rail end later in the pipeline.
          // Reject alignment if even that placement leaves a symbol crossed.
          !groundLabelBounds.some((bounds) =>
            tracePathCrossesAnyBounds(candidate.tracePath, bounds),
          ) &&
          !doesPathOverlapTraceStrokes(candidate.tracePath, otherNetTraces) &&
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

      const metrics = getTraceGeometryMetrics(
        candidateTraces,
        allCandidateTraces,
      )
      if (metrics.otherNetCrossings > baseline.otherNetCrossings) continue
      // A fixed label anchor determines the rail coordinate. It may lengthen
      // endpoint legs, but it must still preserve turns and every safety gate.
      if (
        options?.coordinateIsFixedByLabel
          ? metrics.turnCount > baseline.turnCount
          : !isReadabilityImprovement(metrics, baseline)
      ) {
        continue
      }

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

      const candidate = {
        traces: allCandidateTraces,
        changedTraceIds,
        score,
      }
      if (!best || scoreIsBetter(candidate.score, best.score)) best = candidate
    }

    return best
  }

  const originalCandidate = evaluateCoordinates(
    fixedLabelCoordinate === null
      ? originalCoordinates
      : [fixedLabelCoordinate],
    { coordinateIsFixedByLabel: fixedLabelCoordinate !== null },
  )
  if (originalCandidate) return originalCandidate

  if (fixedLabelCoordinate !== null) return null

  return evaluateCoordinates(
    getRailAlignmentFallbackCoordinates({
      group,
      originalCoordinates,
      otherNetTraces,
    }),
  )
}
