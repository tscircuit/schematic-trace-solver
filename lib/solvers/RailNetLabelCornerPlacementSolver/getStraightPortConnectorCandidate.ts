import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { getSameNetJunctions } from "lib/utils/getSameNetJunctions"
import { EPS, getDistance, tracePathContainsPoint } from "./geometry"
import type { TraceCornerCandidate } from "./types"

const LABEL_TRACE_CLEARANCE = 0.1

type PortConnectorParams = {
  label: NetLabelPlacement
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<string>
  inputProblem: InputProblem
}

const getPortConnectors = (params: PortConnectorParams) => {
  const { label, traces, netLabelConnectorTraceIds, inputProblem } = params
  if (
    label.pinIds.length !== 1 ||
    (label.orientation !== "y+" && label.orientation !== "y-")
  )
    return []

  const pin = inputProblem.chips
    .flatMap((chip) => chip.pins)
    .find((pin) => pin.pinId === label.pinIds[0])
  if (!pin) return []

  return traces.flatMap((connector) => {
    if (
      !netLabelConnectorTraceIds.has(connector.mspPairId) ||
      connector.globalConnNetId !== label.globalConnNetId ||
      connector.pinIds.length !== 1 ||
      connector.pinIds[0] !== pin.pinId
    )
      return []

    const path = [...simplifyPath(connector.tracePath)]
    if (path.length < 2) return []
    const reversed = getDistance(path.at(-1)!, pin) <= EPS
    if (reversed) path.reverse()
    if (
      getDistance(path[0]!, pin) > EPS ||
      getDistance(path.at(-1)!, label.anchorPoint) > EPS ||
      Math.abs(path[1]!.y - pin.y) > EPS ||
      (label.anchorPoint.x - pin.x) * (path[1]!.x - pin.x) <= EPS
    )
      return []

    return [{ connector, path, pin, reversed }]
  })
}

const preservesPortConnections = (
  params: PortConnectorParams,
  connector: SolvedTracePath,
  reroutedTracePath: SolvedTracePath["tracePath"],
) => {
  const { inputProblem, traces, netLabelPlacements, label } = params
  const protectedPoints = [
    ...getSameNetJunctions(connector, traces),
    ...inputProblem.chips.flatMap((chip) => chip.pins),
    ...netLabelPlacements
      .filter((other) => other !== label)
      .map((other) => other.anchorPoint),
  ].filter((point) => tracePathContainsPoint(connector.tracePath, point))
  return (
    protectedPoints.every((point) =>
      tracePathContainsPoint(reroutedTracePath, point),
    ) &&
    // An existing crossing may move along the same wire; don't add crossings.
    traces.every(
      (other) =>
        other.globalConnNetId === connector.globalConnNetId ||
        countPathIntersections(reroutedTracePath, other.tracePath) <=
          countPathIntersections(connector.tracePath, other.tracePath),
    )
  )
}

/** Project a terminal rail label onto its pin's exit row after routing clears it. */
export const getStraightPortConnectorCandidate = (
  params: PortConnectorParams,
): TraceCornerCandidate | undefined => {
  for (const port of getPortConnectors(params)) {
    if (port.path.length < 4) continue
    const { label } = params
    const { connector, pin } = port
    const anchorPoint = { x: label.anchorPoint.x, y: pin.y }
    const reroutedTracePath = [port.path[0]!, anchorPoint]
    if (!preservesPortConnections(params, connector, reroutedTracePath))
      continue

    return {
      anchorPoint,
      traceId: connector.mspPairId,
      distance: getDistance(anchorPoint, label.anchorPoint),
      pinAligned: true,
      reroutedTracePath,
    }
  }
}

/** Extend a single-elbow port connector to obstacle and label boundaries. */
export const getOutwardPortConnectorCandidates = (
  params: PortConnectorParams,
): TraceCornerCandidate[] => {
  return getPortConnectors(params).flatMap((port) => {
    if (port.path.length !== 3) return []
    const { label, traces, netLabelPlacements, inputProblem } = params
    const { connector, path, pin, reversed } = port
    const facingSign = label.orientation === "y+" ? 1 : -1
    if (
      Math.abs(path[1]!.x - label.anchorPoint.x) > EPS ||
      (label.anchorPoint.y - pin.y) * facingSign <= EPS
    )
      return []

    const direction = Math.sign(label.anchorPoint.x - pin.x)
    const bounds = getRectBounds(label.center, label.width, label.height)
    const obstacles = [
      ...getObstacleRects(inputProblem),
      ...netLabelPlacements
        .filter((other) => other !== label)
        .map((other) => getRectBounds(other.center, other.width, other.height)),
      ...traces
        .filter((trace) => trace.mspPairId !== connector.mspPairId)
        .flatMap((trace) =>
          trace.tracePath.slice(1).map((end, index) => {
            const start = trace.tracePath[index]!
            return {
              minX: Math.min(start.x, end.x),
              maxX: Math.max(start.x, end.x),
              minY: Math.min(start.y, end.y),
              maxY: Math.max(start.y, end.y),
            }
          }),
        ),
    ]
    // These are a finite set of clearance boundaries, ordered nearest first.
    // Include full neighboring label bounds, even when only their connector
    // currently collides: moving them can bring the two label bodies together.
    const coordinates = new Set(
      obstacles
        .filter(
          (obstacle) =>
            obstacle.maxY >= bounds.minY - EPS &&
            obstacle.minY <= bounds.maxY + EPS,
        )
        .map(
          (obstacle) =>
            (direction < 0 ? obstacle.minX : obstacle.maxX) +
            direction * (label.width / 2 + LABEL_TRACE_CLEARANCE),
        )
        .filter((x) => (x - label.anchorPoint.x) * direction > EPS),
    )
    return [...coordinates]
      .sort((a, b) => direction * (a - b))
      .flatMap((x) => {
        const anchorPoint = { ...label.anchorPoint, x }
        const reroutedTracePath = [path[0]!, { x, y: pin.y }, anchorPoint]
        if (!preservesPortConnections(params, connector, reroutedTracePath))
          return []
        return [
          {
            anchorPoint,
            traceId: connector.mspPairId,
            distance: getDistance(anchorPoint, label.anchorPoint),
            pinAligned: true,
            reroutedTracePath: reversed
              ? reroutedTracePath.reverse()
              : reroutedTracePath,
          },
        ]
      })
  })
}
