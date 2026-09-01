import type { Bounds, Point } from "@tscircuit/math-utils"
import {
  getPathLength,
  isPathCollidingWithChipInterior,
} from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type TextBoxObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import { countTurns } from "./countTurns"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"
import {
  generateConnectorCrossingRerouteCandidates,
  getTraceObstacleBounds,
  type ConnectorCrossingRerouteCandidate,
} from "./sub-solver/generateConnectorCrossingRerouteCandidates"
import { findPerpendicularPathCrossings } from "./sub-solver/findIntersectionsWithObstacles"

const EPS = 1e-6

const compareNumbers = (first: number, second: number) =>
  Math.abs(first - second) <= EPS ? 0 : first - second

interface ConnectorCrossing {
  connector: SolvedTracePath
  connectorSegmentIndex: number
  otherTrace: SolvedTracePath
  otherSegmentIndex: number
}

const getConnectorCrossings = (
  traces: SolvedTracePath[],
  connectorTraceIds: ReadonlySet<string>,
) => {
  const crossings: ConnectorCrossing[] = []
  const connectors = traces.filter((trace) =>
    connectorTraceIds.has(trace.mspPairId),
  )

  for (const connector of connectors) {
    for (const otherTrace of traces) {
      if (otherTrace.mspPairId === connector.mspPairId) continue
      if (otherTrace.globalConnNetId === connector.globalConnNetId) continue
      if (
        connectorTraceIds.has(otherTrace.mspPairId) &&
        otherTrace.mspPairId < connector.mspPairId
      ) {
        continue
      }
      for (const crossing of findPerpendicularPathCrossings(
        connector.tracePath,
        otherTrace.tracePath,
        { includeTerminalSegments: true },
      )) {
        crossings.push({
          connector,
          connectorSegmentIndex: crossing.pathSegmentIndex,
          otherTrace,
          otherSegmentIndex: crossing.otherPathSegmentIndex,
        })
      }
    }
  }
  return crossings
}

const getForeignTraceCrossingCounts = (
  targetTrace: SolvedTracePath,
  traces: SolvedTracePath[],
) => {
  const crossingCounts = new Map<string, number>()
  for (const otherTrace of traces) {
    if (otherTrace.mspPairId === targetTrace.mspPairId) continue
    if (otherTrace.globalConnNetId === targetTrace.globalConnNetId) continue
    const crossingCount = findPerpendicularPathCrossings(
      targetTrace.tracePath,
      otherTrace.tracePath,
      { includeTerminalSegments: true },
    ).length
    if (crossingCount > 0) {
      crossingCounts.set(otherTrace.mspPairId, crossingCount)
    }
  }
  return crossingCounts
}

const getTotalCrossingCount = (crossingCounts: ReadonlyMap<string, number>) =>
  [...crossingCounts.values()].reduce((sum, count) => sum + count, 0)

const areCrossingCountsSubset = (
  candidate: ReadonlyMap<string, number>,
  baseline: ReadonlyMap<string, number>,
) =>
  [...candidate].every(
    ([traceId, count]) => count <= (baseline.get(traceId) ?? 0),
  )

const isForeignLabel = ({
  label,
  trace,
  mergedLabelNetIdMap,
}: {
  label: NetLabelPlacement
  trace: SolvedTracePath
  mergedLabelNetIdMap: Record<string, Set<string>>
}) => {
  const mergedNetIds = mergedLabelNetIdMap[label.globalConnNetId]
  return mergedNetIds
    ? !mergedNetIds.has(trace.globalConnNetId)
    : label.globalConnNetId !== trace.globalConnNetId
}

const getForeignLabelBounds = ({
  trace,
  labels,
  mergedLabelNetIdMap,
}: {
  trace: SolvedTracePath
  labels: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}) =>
  labels
    .filter((label) => isForeignLabel({ label, trace, mergedLabelNetIdMap }))
    .map((label) => getRectBounds(label.center, label.width, label.height))

const getCollidingBoundsIndices = (path: Point[], bounds: Bounds[]) =>
  new Set(
    bounds.flatMap((obstacleBounds, index) =>
      hasCollisionsWithLabels(path, [obstacleBounds]) ? [index] : [],
    ),
  )

const isSubset = (
  candidate: ReadonlySet<number>,
  baseline: ReadonlySet<number>,
) => [...candidate].every((value) => baseline.has(value))

export const rerouteGeneratedNetLabelConnectorCrossings = ({
  inputProblem,
  traces,
  netLabelPlacements,
  mergedLabelNetIdMap,
  clearance,
  eligibleTraceIds,
  connectorTraceIds,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  clearance: number
  eligibleTraceIds?: ReadonlySet<string>
  connectorTraceIds: ReadonlySet<string>
}) => {
  let outputTraces = [...traces]
  const chipObstacles = getObstacleRects(inputProblem).filter(
    (obstacle) => obstacle.kind === "chip",
  )
  const textObstacles = getObstacleRects(inputProblem).filter(
    (obstacle): obstacle is TextBoxObstacleRect => obstacle.kind === "text_box",
  )
  let reroutedTraceCount = 0
  const initialConnectorCrossingCount = getConnectorCrossings(
    outputTraces,
    connectorTraceIds,
  ).length

  while (true) {
    const crossings = getConnectorCrossings(outputTraces, connectorTraceIds)
    if (crossings.length === 0) break

    const evaluatedCandidates = crossings.flatMap((crossing) => {
      const candidates: ConnectorCrossingRerouteCandidate[] = []
      if (
        connectorTraceIds.has(crossing.otherTrace.mspPairId) ||
        !eligibleTraceIds ||
        eligibleTraceIds.has(crossing.otherTrace.mspPairId)
      ) {
        candidates.push(
          ...generateConnectorCrossingRerouteCandidates({
            trace: crossing.otherTrace,
            segmentIndex: crossing.otherSegmentIndex,
            obstacleBounds: getTraceObstacleBounds({
              trace: crossing.connector,
              segmentIndex: crossing.connectorSegmentIndex,
              labels: netLabelPlacements,
            }),
            clearance,
          }),
        )
      }
      candidates.push(
        ...generateConnectorCrossingRerouteCandidates({
          trace: crossing.connector,
          segmentIndex: crossing.connectorSegmentIndex,
          obstacleBounds: getTraceObstacleBounds({
            trace: crossing.otherTrace,
            segmentIndex: crossing.otherSegmentIndex,
            labels: netLabelPlacements,
          }),
          clearance,
        }),
      )

      return candidates.flatMap((candidate) => {
        const traceIndex = outputTraces.findIndex(
          (trace) => trace.mspPairId === candidate.traceId,
        )
        const originalTrace = outputTraces[traceIndex]
        if (!originalTrace) return []

        const foreignTraces = outputTraces.filter(
          (trace) =>
            trace.mspPairId !== candidate.traceId &&
            trace.globalConnNetId !== originalTrace.globalConnNetId,
        )
        const foreignLabelBounds = getForeignLabelBounds({
          trace: originalTrace,
          labels: netLabelPlacements,
          mergedLabelNetIdMap,
        })
        const originalLabelCollisions = getCollidingBoundsIndices(
          originalTrace.tracePath,
          foreignLabelBounds,
        )
        const candidateLabelCollisions = getCollidingBoundsIndices(
          candidate.path,
          foreignLabelBounds,
        )
        if (
          isPathCollidingWithChipInterior(candidate.path, chipObstacles) ||
          isPathCollidingWithObstacles(candidate.path, textObstacles) ||
          !isSubset(candidateLabelCollisions, originalLabelCollisions) ||
          doesPathCoincideWithTraces(candidate.path, foreignTraces)
        ) {
          return []
        }

        const candidateTrace = { ...originalTrace, tracePath: candidate.path }
        const candidateTraces = [...outputTraces]
        candidateTraces[traceIndex] = candidateTrace
        const remainingConnectorCrossings = getConnectorCrossings(
          candidateTraces,
          connectorTraceIds,
        ).length
        if (remainingConnectorCrossings >= crossings.length) return []

        const originalForeignCrossingCounts = getForeignTraceCrossingCounts(
          originalTrace,
          outputTraces,
        )
        const candidateForeignCrossingCounts = getForeignTraceCrossingCounts(
          candidateTrace,
          candidateTraces,
        )
        if (
          !areCrossingCountsSubset(
            candidateForeignCrossingCounts,
            originalForeignCrossingCounts,
          )
        ) {
          return []
        }

        return [
          {
            ...candidate,
            remainingConnectorCrossings,
            candidateForeignCrossings: getTotalCrossingCount(
              candidateForeignCrossingCounts,
            ),
            turnIncrease:
              countTurns(candidate.path) - countTurns(originalTrace.tracePath),
            lengthIncrease:
              getPathLength(candidate.path) -
              getPathLength(originalTrace.tracePath),
          },
        ]
      })
    })

    evaluatedCandidates.sort(
      (first, second) =>
        first.remainingConnectorCrossings -
          second.remainingConnectorCrossings ||
        first.candidateForeignCrossings - second.candidateForeignCrossings ||
        compareNumbers(first.lengthIncrease, second.lengthIncrease) ||
        first.turnIncrease - second.turnIncrease ||
        Number(first.kind !== "balanced") -
          Number(second.kind !== "balanced") ||
        compareNumbers(getPathLength(first.path), getPathLength(second.path)),
    )
    const bestCandidate = evaluatedCandidates[0]
    if (!bestCandidate) break

    const traceIndex = outputTraces.findIndex(
      (trace) => trace.mspPairId === bestCandidate.traceId,
    )
    outputTraces[traceIndex] = {
      ...outputTraces[traceIndex]!,
      tracePath: bestCandidate.path,
    }
    reroutedTraceCount++
  }

  return {
    traces: outputTraces,
    reroutedTraceCount,
    initialConnectorCrossingCount,
    remainingConnectorCrossingCount: getConnectorCrossings(
      outputTraces,
      connectorTraceIds,
    ).length,
  }
}
