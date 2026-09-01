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

const getSegmentDirection = (start: Point, end: Point) => {
  if (Math.abs(start.x - end.x) <= EPS) {
    return end.y > start.y ? "y+" : "y-"
  }
  return end.x > start.x ? "x+" : "x-"
}

const getSegmentLength = (start: Point, end: Point) =>
  Math.abs(end.x - start.x) + Math.abs(end.y - start.y)

const preservesTerminalEscapes = (
  originalPath: Point[],
  candidatePath: Point[],
  minimumEscapeLength: number,
) => {
  if (originalPath.length < 2 || candidatePath.length < 2) return false
  const directionsArePreserved =
    getSegmentDirection(originalPath[0]!, originalPath[1]!) ===
      getSegmentDirection(candidatePath[0]!, candidatePath[1]!) &&
    getSegmentDirection(originalPath.at(-2)!, originalPath.at(-1)!) ===
      getSegmentDirection(candidatePath.at(-2)!, candidatePath.at(-1)!)
  if (!directionsArePreserved) return false

  const originalStartLength = getSegmentLength(
    originalPath[0]!,
    originalPath[1]!,
  )
  const originalEndLength = getSegmentLength(
    originalPath.at(-2)!,
    originalPath.at(-1)!,
  )
  const candidateStartLength = getSegmentLength(
    candidatePath[0]!,
    candidatePath[1]!,
  )
  const candidateEndLength = getSegmentLength(
    candidatePath.at(-2)!,
    candidatePath.at(-1)!,
  )

  return (
    candidateStartLength + EPS >=
      Math.min(originalStartLength, minimumEscapeLength) &&
    candidateEndLength + EPS >= Math.min(originalEndLength, minimumEscapeLength)
  )
}

const getNearChipBoundaryLength = (
  path: Point[],
  chipBounds: Bounds[],
  clearance: number,
) => {
  let totalLength = 0
  for (let pointIndex = 0; pointIndex < path.length - 1; pointIndex++) {
    const start = path[pointIndex]!
    const end = path[pointIndex + 1]!
    const isVertical = Math.abs(start.x - end.x) <= EPS

    for (const bounds of chipBounds) {
      if (isVertical) {
        const isNearVerticalEdge =
          Math.abs(start.x - bounds.minX) <= clearance + EPS ||
          Math.abs(start.x - bounds.maxX) <= clearance + EPS
        if (!isNearVerticalEdge) continue
        totalLength += Math.max(
          0,
          Math.min(Math.max(start.y, end.y), bounds.maxY) -
            Math.max(Math.min(start.y, end.y), bounds.minY),
        )
      } else {
        const isNearHorizontalEdge =
          Math.abs(start.y - bounds.minY) <= clearance + EPS ||
          Math.abs(start.y - bounds.maxY) <= clearance + EPS
        if (!isNearHorizontalEdge) continue
        totalLength += Math.max(
          0,
          Math.min(Math.max(start.x, end.x), bounds.maxX) -
            Math.max(Math.min(start.x, end.x), bounds.minX),
        )
      }
    }
  }
  return totalLength
}

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
  const originalTraceMap = new Map(
    traces.map((trace) => [trace.mspPairId, trace]),
  )
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
      if (connectorTraceIds.has(crossing.otherTrace.mspPairId)) return []
      if (
        eligibleTraceIds &&
        !eligibleTraceIds.has(crossing.otherTrace.mspPairId)
      ) {
        return []
      }

      const candidates: ConnectorCrossingRerouteCandidate[] =
        generateConnectorCrossingRerouteCandidates({
          trace: crossing.otherTrace,
          segmentIndex: crossing.otherSegmentIndex,
          obstacleBounds: getTraceObstacleBounds({
            trace: crossing.connector,
            segmentIndex: crossing.connectorSegmentIndex,
            labels: netLabelPlacements,
          }),
          clearance,
        })

      return candidates.flatMap((candidate) => {
        const traceIndex = outputTraces.findIndex(
          (trace) => trace.mspPairId === candidate.traceId,
        )
        const originalTrace = outputTraces[traceIndex]
        if (!originalTrace) return []
        const initialTrace = originalTraceMap.get(candidate.traceId)
        if (!initialTrace) return []

        const turnIncrease =
          countTurns(candidate.path) - countTurns(initialTrace.tracePath)
        const lengthIncrease =
          getPathLength(candidate.path) - getPathLength(initialTrace.tracePath)
        // A generated connector is a fixed attachment between its source and
        // label anchor, so cleanup must not send it on a long detour. Move the
        // established trace only when a shortest-path alternative exists. One
        // rectangular obstacle can require at most two additional turns; more
        // than that is a visibly worse route rather than a clean alternative.
        // Preserve both pin escapes and reject candidates that add a run beside
        // a component edge, which prevents a local crossing fix from dragging
        // the route through an unrelated pin bank.
        if (
          lengthIncrease > EPS ||
          turnIncrease > 2 ||
          !preservesTerminalEscapes(
            initialTrace.tracePath,
            candidate.path,
            clearance * 2,
          ) ||
          getNearChipBoundaryLength(candidate.path, chipObstacles, clearance) >
            getNearChipBoundaryLength(
              initialTrace.tracePath,
              chipObstacles,
              clearance,
            ) +
              EPS
        ) {
          return []
        }

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
            turnIncrease,
            lengthIncrease,
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
