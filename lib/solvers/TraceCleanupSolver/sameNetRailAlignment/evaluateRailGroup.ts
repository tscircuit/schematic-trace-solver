import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { moveAttachedLabelsToReroutedTrace } from "lib/solvers/Example28Solver/labelMovement"
import {
  getLabelBounds,
  rectsOverlap,
} from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/geometry"
import {
  doesPathCoincideWithTraces,
  doesPathOverlapTraceStrokes,
} from "lib/utils/doesPathCoincideWithTraces"
import { getDistinctCoordinates, pointsEqual } from "./geometry"
import { getRailAlignmentFallbackCoordinates } from "./getRailAlignmentFallbackCoordinates"
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

const moveVerticalLabelsWithReroutedTraces = ({
  originalTraces,
  candidateTraces,
  netLabelPlacements,
}: {
  originalTraces: SolvedTracePath[]
  candidateTraces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  let movedNetLabelPlacements = [...netLabelPlacements]
  const originalTraceMap = new Map(
    originalTraces.map((trace) => [trace.mspPairId, trace]),
  )

  for (const candidateTrace of candidateTraces) {
    const originalTrace = originalTraceMap.get(candidateTrace.mspPairId)!
    if (!tracePathChanged(originalTrace, candidateTrace)) continue

    const currentNetLabelPlacements = movedNetLabelPlacements
    const movedLabels = moveAttachedLabelsToReroutedTrace({
      trace: originalTrace,
      originalTracePath: originalTrace.tracePath,
      reroutedTracePath: candidateTrace.tracePath,
      netLabelPlacements: currentNetLabelPlacements,
    })
    movedNetLabelPlacements = movedLabels.map((movedLabel, labelIndex) => {
      const originalLabel = currentNetLabelPlacements[labelIndex]!
      return originalLabel.orientation === "y+" ||
        originalLabel.orientation === "y-"
        ? movedLabel
        : originalLabel
    })
  }

  return movedNetLabelPlacements
}

const introducesCrossNetLabelOverlap = (
  before: NetLabelPlacement[],
  after: NetLabelPlacement[],
) => {
  for (let firstIndex = 0; firstIndex < after.length; firstIndex++) {
    const firstAfter = after[firstIndex]!
    const firstBefore = before[firstIndex]
    if (!firstBefore) return true

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < after.length;
      secondIndex++
    ) {
      const secondAfter = after[secondIndex]!
      const secondBefore = before[secondIndex]
      if (!secondBefore) return true
      if (firstAfter.globalConnNetId === secondAfter.globalConnNetId) continue

      const overlappedBefore = rectsOverlap(
        getLabelBounds(firstBefore),
        getLabelBounds(secondBefore),
      )
      const overlapsAfter = rectsOverlap(
        getLabelBounds(firstAfter),
        getLabelBounds(secondAfter),
      )
      if (!overlappedBefore && overlapsAfter) return true
    }
  }

  return false
}

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
  const originalCoordinates = getDistinctCoordinates(
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

  const evaluateCoordinates = (coordinates: number[]) => {
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
      const candidateNetLabelPlacements = moveVerticalLabelsWithReroutedTraces({
        originalTraces: originalGroupTraces,
        candidateTraces,
        netLabelPlacements,
      })
      if (
        introducesCrossNetLabelOverlap(
          netLabelPlacements,
          candidateNetLabelPlacements,
        )
      ) {
        continue
      }
      const candidatesAreClear = candidateTraces.every(
        (candidate) =>
          !isPathCollidingWithObstacles(candidate.tracePath, obstacles) &&
          detectTraceLabelOverlap({
            traces: [candidate],
            netLabels: candidateNetLabelPlacements,
          }).length === 0 &&
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
        !preservesLabelAnchors(
          netLabelPlacements,
          traces,
          allCandidateTraces,
          candidateNetLabelPlacements,
        )
      ) {
        continue
      }

      const metrics = getTraceGeometryMetrics(
        candidateTraces,
        allCandidateTraces,
      )
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

      const candidate = {
        traces: allCandidateTraces,
        netLabelPlacements: candidateNetLabelPlacements,
        changedTraceIds,
        score,
      }
      if (!best || scoreIsBetter(candidate.score, best.score)) best = candidate
    }

    return best
  }

  const originalCandidate = evaluateCoordinates(originalCoordinates)
  if (originalCandidate) return originalCandidate

  return evaluateCoordinates(
    getRailAlignmentFallbackCoordinates({
      group,
      originalCoordinates,
      otherNetTraces,
    }),
  )
}
