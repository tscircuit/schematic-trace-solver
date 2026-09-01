import type { Bounds } from "@tscircuit/math-utils"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import { countTurns } from "./countTurns"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"
import { findPerpendicularPathCrossings } from "./sub-solver/findIntersectionsWithObstacles"
import { generatePerpendicularTraceDetours } from "./sub-solver/generateLShapeRerouteCandidates"
import { isPathColliding } from "./sub-solver/isPathColliding"

const EPS = 1e-6

const getConnectorObstacleBounds = (
  connector: SolvedTracePath,
  segmentIndex: number,
  labels: NetLabelPlacement[],
): Bounds => {
  const start = connector.tracePath[segmentIndex]!
  const end = connector.tracePath[segmentIndex + 1]!
  const bounds = {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }

  for (const label of labels) {
    if (label.globalConnNetId !== connector.globalConnNetId) continue
    if (!label.pinIds.every((pinId) => connector.pinIds.includes(pinId)))
      continue
    if (!tracePathContainsPoint(connector.tracePath, label.anchorPoint))
      continue

    const labelBounds = getRectBounds(label.center, label.width, label.height)
    bounds.minX = Math.min(bounds.minX, labelBounds.minX)
    bounds.minY = Math.min(bounds.minY, labelBounds.minY)
    bounds.maxX = Math.max(bounds.maxX, labelBounds.maxX)
    bounds.maxY = Math.max(bounds.maxY, labelBounds.maxY)
  }

  return bounds
}

const getEligibleConnectorCrossings = (
  traces: SolvedTracePath[],
  connectorTraceIds: ReadonlySet<string>,
  eligibleTraceIds?: ReadonlySet<string>,
) => {
  const crossings: Array<{
    traceIndex: number
    connector: SolvedTracePath
    connectorSegmentIndex: number
    traceSegmentIndex: number
  }> = []

  for (const connector of traces) {
    if (!connectorTraceIds.has(connector.mspPairId)) continue

    for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
      const trace = traces[traceIndex]!
      if (trace.mspPairId === connector.mspPairId) continue
      if (connectorTraceIds.has(trace.mspPairId)) continue
      if (trace.globalConnNetId === connector.globalConnNetId) continue
      if (eligibleTraceIds && !eligibleTraceIds.has(trace.mspPairId)) continue

      for (const crossing of findPerpendicularPathCrossings(
        trace.tracePath,
        connector.tracePath,
        { includeTerminalSegments: true },
      )) {
        crossings.push({
          traceIndex,
          connector,
          connectorSegmentIndex: crossing.otherPathSegmentIndex,
          traceSegmentIndex: crossing.pathSegmentIndex,
        })
      }
    }
  }

  return crossings
}

// Generated label connectors are added after the component traces are routed.
// Reuse the normal perpendicular-detour candidates here, keeping connectors
// fixed and considering only traces that came from the original routing pass.
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
  const outputTraces = [...traces]
  const componentAndTextObstacles = getObstacleRects(inputProblem).filter(
    (obstacle) => obstacle.kind === "chip" || obstacle.kind === "text_box",
  )
  let reroutedTraceCount = 0

  while (true) {
    const candidates = getEligibleConnectorCrossings(
      outputTraces,
      connectorTraceIds,
      eligibleTraceIds,
    ).flatMap((crossing) => {
      const trace = outputTraces[crossing.traceIndex]!
      const obstacleBounds = getConnectorObstacleBounds(
        crossing.connector,
        crossing.connectorSegmentIndex,
        netLabelPlacements,
      )
      const foreignTraces = outputTraces.filter(
        (otherTrace) =>
          otherTrace.mspPairId !== trace.mspPairId &&
          otherTrace.globalConnNetId !== trace.globalConnNetId,
      )
      const foreignLabelBounds = netLabelPlacements
        .filter((label) => {
          const mergedNetIds = mergedLabelNetIdMap[label.globalConnNetId]
          return mergedNetIds
            ? !mergedNetIds.has(trace.globalConnNetId)
            : label.globalConnNetId !== trace.globalConnNetId
        })
        .map((label) => getRectBounds(label.center, label.width, label.height))

      return generatePerpendicularTraceDetours({
        trace,
        segmentIndex: crossing.traceSegmentIndex,
        obstacleStart:
          crossing.connector.tracePath[crossing.connectorSegmentIndex]!,
        obstacleEnd:
          crossing.connector.tracePath[crossing.connectorSegmentIndex + 1]!,
        obstacleBounds,
        chipBounds: [],
        clearance,
      })
        .filter(
          (candidate) =>
            getPathLength(candidate.path) <=
              getPathLength(trace.tracePath) + EPS &&
            countTurns(candidate.path) <= countTurns(trace.tracePath) + 2 &&
            !isPathCollidingWithObstacles(
              candidate.path,
              componentAndTextObstacles,
            ) &&
            !hasCollisionsWithLabels(candidate.path, foreignLabelBounds) &&
            !isPathColliding(candidate.path, foreignTraces, trace.mspPairId)
              .isColliding &&
            !doesPathCoincideWithTraces(candidate.path, foreignTraces),
        )
        .map((candidate) => ({
          ...candidate,
          traceIndex: crossing.traceIndex,
        }))
    })

    candidates.sort((first, second) => {
      const lengthDifference =
        getPathLength(first.path) - getPathLength(second.path)
      return Math.abs(lengthDifference) > EPS
        ? lengthDifference
        : countTurns(first.path) - countTurns(second.path)
    })
    const bestCandidate = candidates[0]
    if (!bestCandidate) break

    outputTraces[bestCandidate.traceIndex] = {
      ...outputTraces[bestCandidate.traceIndex]!,
      tracePath: bestCandidate.path,
    }
    reroutedTraceCount++
  }

  return {
    traces: outputTraces,
    reroutedTraceCount,
  }
}
