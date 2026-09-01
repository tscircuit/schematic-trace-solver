import type { Bounds, Point } from "@tscircuit/math-utils"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getPathLength,
  isPathCollidingWithChipInterior,
} from "lib/solvers/Example28Solver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getObstacleRects,
  type TextBoxObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"
import { simplifyPath } from "./simplifyPath"
import { findPerpendicularPathCrossings } from "./sub-solver/findIntersectionsWithObstacles"

const GENERATED_CONNECTOR_PREFIX = "available-net-orientation-"
const EPS = 1e-6

const pointsAreEqual = (first: Point, second: Point) =>
  Math.abs(first.x - second.x) <= EPS && Math.abs(first.y - second.y) <= EPS

const traceContainsPoint = (trace: SolvedTracePath, point: Point) =>
  trace.tracePath.some((tracePoint) => pointsAreEqual(tracePoint, point))

const getConnectorObstacleBounds = ({
  connector,
  segmentIndex,
  labels,
}: {
  connector: SolvedTracePath
  segmentIndex: number
  labels: NetLabelPlacement[]
}): Bounds => {
  const segmentStart = connector.tracePath[segmentIndex]!
  const segmentEnd = connector.tracePath[segmentIndex + 1]!
  const bounds: Bounds = {
    minX: Math.min(segmentStart.x, segmentEnd.x),
    minY: Math.min(segmentStart.y, segmentEnd.y),
    maxX: Math.max(segmentStart.x, segmentEnd.x),
    maxY: Math.max(segmentStart.y, segmentEnd.y),
  }

  for (const label of labels) {
    if (label.globalConnNetId !== connector.globalConnNetId) continue
    if (!label.pinIds.every((pinId) => connector.pinIds.includes(pinId))) {
      continue
    }
    if (!traceContainsPoint(connector, label.anchorPoint)) continue

    const labelBounds = getRectBounds(label.center, label.width, label.height)
    bounds.minX = Math.min(bounds.minX, labelBounds.minX)
    bounds.minY = Math.min(bounds.minY, labelBounds.minY)
    bounds.maxX = Math.max(bounds.maxX, labelBounds.maxX)
    bounds.maxY = Math.max(bounds.maxY, labelBounds.maxY)
  }

  return bounds
}

const getCenteredDetourCoordinate = ({
  anchorCoordinate,
  obstacleMin,
  obstacleMax,
  clearance,
}: {
  anchorCoordinate: number
  obstacleMin: number
  obstacleMax: number
  clearance: number
}) => {
  if (anchorCoordinate < obstacleMin - clearance) {
    return (anchorCoordinate + obstacleMin - clearance) / 2
  }
  if (anchorCoordinate > obstacleMax + clearance) {
    return (anchorCoordinate + obstacleMax + clearance) / 2
  }
  return null
}

/**
 * Builds a detour through the center of the open corridor between the
 * generated connector's label and the trace's next anchor. A centered route
 * is intentionally the only candidate: if that corridor is blocked, the
 * established trace is preserved instead of being squeezed against a label.
 */
const generateCenteredDetourCandidates = ({
  trace,
  segmentIndex,
  obstacleBounds,
  clearance,
}: {
  trace: SolvedTracePath
  segmentIndex: number
  obstacleBounds: Bounds
  clearance: number
}): Point[][] => {
  const buildCandidate = (path: Point[], index: number): Point[] | null => {
    const start = path[index]
    const end = path[index + 1]
    const nextAnchor = path[index + 2]
    if (!start || !end || !nextAnchor) return null

    const movingAxis: "x" | "y" = Math.abs(start.x - end.x) <= EPS ? "y" : "x"
    const detourAxis = movingAxis === "x" ? "y" : "x"
    const movingMin =
      movingAxis === "x" ? obstacleBounds.minX : obstacleBounds.minY
    const movingMax =
      movingAxis === "x" ? obstacleBounds.maxX : obstacleBounds.maxY
    const detourMin =
      detourAxis === "x" ? obstacleBounds.minX : obstacleBounds.minY
    const detourMax =
      detourAxis === "x" ? obstacleBounds.maxX : obstacleBounds.maxY
    const movingMidpoint = (movingMin + movingMax) / 2
    const gate =
      start[movingAxis] < movingMidpoint
        ? movingMin - clearance
        : movingMax + clearance
    const detourCoordinate = getCenteredDetourCoordinate({
      anchorCoordinate: nextAnchor[detourAxis],
      obstacleMin: detourMin,
      obstacleMax: detourMax,
      clearance,
    })
    if (detourCoordinate === null) return null

    return simplifyPath([
      ...path.slice(0, index + 1),
      { ...start, [movingAxis]: gate },
      { ...start, [movingAxis]: gate, [detourAxis]: detourCoordinate },
      { ...end, [detourAxis]: detourCoordinate },
      ...path.slice(index + 2),
    ])
  }

  const candidates: Point[][] = []
  const forwardCandidate = buildCandidate(trace.tracePath, segmentIndex)
  if (forwardCandidate) candidates.push(forwardCandidate)

  const reversedPath = [...trace.tracePath].reverse()
  const reversedIndex = trace.tracePath.length - 2 - segmentIndex
  const reversedCandidate = buildCandidate(reversedPath, reversedIndex)
  if (reversedCandidate) candidates.push(reversedCandidate.reverse())

  return candidates
}

const getForeignLabelBounds = ({
  trace,
  labels,
}: {
  trace: SolvedTracePath
  labels: NetLabelPlacement[]
}) =>
  labels
    .filter((label) => label.globalConnNetId !== trace.globalConnNetId)
    .map((label) => getRectBounds(label.center, label.width, label.height))

const hasStrictForeignTraceCrossing = ({
  path,
  trace,
  allTraces,
}: {
  path: Point[]
  trace: SolvedTracePath
  allTraces: SolvedTracePath[]
}) =>
  allTraces.some(
    (otherTrace) =>
      otherTrace.mspPairId !== trace.mspPairId &&
      otherTrace.globalConnNetId !== trace.globalConnNetId &&
      findPerpendicularPathCrossings(path, otherTrace.tracePath, {
        includeTerminalSegments: true,
      }).length > 0,
  )

export const rerouteGeneratedNetLabelConnectorCrossings = ({
  inputProblem,
  traces,
  netLabelPlacements,
  clearance,
  eligibleTraceIds,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  clearance: number
  eligibleTraceIds?: ReadonlySet<string>
}) => {
  const outputTraces = [...traces]
  const chipObstacles = getObstacleRects(inputProblem).filter(
    (obstacle) => obstacle.kind === "chip",
  )
  const textObstacles = getObstacleRects(inputProblem).filter(
    (obstacle): obstacle is TextBoxObstacleRect => obstacle.kind === "text_box",
  )
  let reroutedTraceCount = 0

  for (const connector of outputTraces.filter((trace) =>
    trace.mspPairId.startsWith(GENERATED_CONNECTOR_PREFIX),
  )) {
    for (let traceIndex = 0; traceIndex < outputTraces.length; traceIndex++) {
      const trace = outputTraces[traceIndex]!
      if (trace.mspPairId.startsWith(GENERATED_CONNECTOR_PREFIX)) continue
      if (trace.globalConnNetId === connector.globalConnNetId) continue
      if (eligibleTraceIds && !eligibleTraceIds.has(trace.mspPairId)) continue

      const crossing = findPerpendicularPathCrossings(
        trace.tracePath,
        connector.tracePath,
        { includeTerminalSegments: true },
      )[0]
      if (!crossing) continue

      const obstacleBounds = getConnectorObstacleBounds({
        connector,
        segmentIndex: crossing.otherPathSegmentIndex,
        labels: netLabelPlacements,
      })
      const foreignTraces = outputTraces.filter(
        (otherTrace) =>
          otherTrace.mspPairId !== trace.mspPairId &&
          otherTrace.globalConnNetId !== trace.globalConnNetId,
      )
      const foreignLabelBounds = getForeignLabelBounds({
        trace,
        labels: netLabelPlacements,
      })
      const candidates = generateCenteredDetourCandidates({
        trace,
        segmentIndex: crossing.pathSegmentIndex,
        obstacleBounds,
        clearance,
      })
        .filter(
          (path) =>
            !isPathCollidingWithChipInterior(path, chipObstacles) &&
            !isPathCollidingWithObstacles(path, textObstacles) &&
            !hasCollisionsWithLabels(path, foreignLabelBounds) &&
            !doesPathCoincideWithTraces(path, foreignTraces) &&
            !hasStrictForeignTraceCrossing({
              path,
              trace,
              allTraces: outputTraces,
            }),
        )
        .sort((first, second) => getPathLength(first) - getPathLength(second))

      const bestCandidate = candidates[0]
      if (!bestCandidate) continue
      outputTraces[traceIndex] = { ...trace, tracePath: bestCandidate }
      reroutedTraceCount++
    }
  }

  return { traces: outputTraces, reroutedTraceCount }
}
