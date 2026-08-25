import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import { simplifyOrthogonalPath } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  EPS,
  tracePathContainsPoint,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const GENERATED_CONNECTOR_PREFIX = "available-net-orientation-"

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS

const getDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const tracesShareCollinearRail = (
  first: SolvedTracePath,
  second: SolvedTracePath,
) => {
  for (
    let firstIndex = 0;
    firstIndex < first.tracePath.length - 1;
    firstIndex++
  ) {
    const firstStart = first.tracePath[firstIndex]!
    const firstEnd = first.tracePath[firstIndex + 1]!
    const firstIsHorizontal = Math.abs(firstStart.y - firstEnd.y) <= EPS
    const firstIsVertical = Math.abs(firstStart.x - firstEnd.x) <= EPS
    if (!firstIsHorizontal && !firstIsVertical) continue

    for (
      let secondIndex = 0;
      secondIndex < second.tracePath.length - 1;
      secondIndex++
    ) {
      const secondStart = second.tracePath[secondIndex]!
      const secondEnd = second.tracePath[secondIndex + 1]!
      const secondIsHorizontal = Math.abs(secondStart.y - secondEnd.y) <= EPS
      const secondIsVertical = Math.abs(secondStart.x - secondEnd.x) <= EPS
      const horizontalRangesTouch =
        Math.max(
          Math.min(firstStart.x, firstEnd.x),
          Math.min(secondStart.x, secondEnd.x),
        ) <=
        Math.min(
          Math.max(firstStart.x, firstEnd.x),
          Math.max(secondStart.x, secondEnd.x),
        ) +
          EPS
      const verticalRangesTouch =
        Math.max(
          Math.min(firstStart.y, firstEnd.y),
          Math.min(secondStart.y, secondEnd.y),
        ) <=
        Math.min(
          Math.max(firstStart.y, firstEnd.y),
          Math.max(secondStart.y, secondEnd.y),
        ) +
          EPS

      if (
        (firstIsHorizontal &&
          secondIsHorizontal &&
          Math.abs(firstStart.y - secondStart.y) <= EPS &&
          horizontalRangesTouch) ||
        (firstIsVertical &&
          secondIsVertical &&
          Math.abs(firstStart.x - secondStart.x) <= EPS &&
          verticalRangesTouch)
      ) {
        return true
      }
    }
  }

  return false
}

const getConnectedRoutedTraces = (
  label: NetLabelPlacement,
  traces: SolvedTracePath[],
) => {
  const routedTraces = traces.filter(
    (trace) =>
      trace.globalConnNetId === label.globalConnNetId &&
      !trace.mspPairId.startsWith(GENERATED_CONNECTOR_PREFIX),
  )
  const connectedTraceIds = new Set(label.mspConnectionPairIds)
  const connectedPinIds = new Set(
    routedTraces
      .filter((trace) => connectedTraceIds.has(trace.mspPairId))
      .flatMap((trace) => trace.pinIds),
  )

  for (let changed = true; changed; ) {
    changed = false
    for (const trace of routedTraces) {
      if (connectedTraceIds.has(trace.mspPairId)) continue
      if (!trace.pinIds.some((pinId) => connectedPinIds.has(pinId))) continue

      connectedTraceIds.add(trace.mspPairId)
      for (const pinId of trace.pinIds) connectedPinIds.add(pinId)
      changed = true
    }
  }

  return routedTraces.filter((trace) => connectedTraceIds.has(trace.mspPairId))
}

interface JunctionCandidate {
  point: Point
  connectorSegmentIndex: number
  distanceFromConnectorStart: number
}

const getClosestRoutedJunctionToAnchor = (
  connectorPath: Point[],
  routedTraces: SolvedTracePath[],
): JunctionCandidate | null => {
  let distanceBeforeSegment = 0
  let best: JunctionCandidate | null = null

  for (
    let connectorSegmentIndex = 0;
    connectorSegmentIndex < connectorPath.length - 1;
    connectorSegmentIndex++
  ) {
    const connectorStart = connectorPath[connectorSegmentIndex]!
    const connectorEnd = connectorPath[connectorSegmentIndex + 1]!

    for (const trace of routedTraces) {
      for (
        let traceSegmentIndex = 0;
        traceSegmentIndex < trace.tracePath.length - 1;
        traceSegmentIndex++
      ) {
        const traceStart = trace.tracePath[traceSegmentIndex]!
        const traceEnd = trace.tracePath[traceSegmentIndex + 1]!
        const candidates = [
          getSegmentIntersection(
            connectorStart,
            connectorEnd,
            traceStart,
            traceEnd,
          ),
          ...[traceStart, traceEnd].filter((point) =>
            tracePathContainsPoint([connectorStart, connectorEnd], point),
          ),
          ...[connectorStart, connectorEnd].filter((point) =>
            tracePathContainsPoint([traceStart, traceEnd], point),
          ),
        ].filter((point): point is Point => point !== null)

        for (const point of candidates) {
          const candidate = {
            point,
            connectorSegmentIndex,
            distanceFromConnectorStart:
              distanceBeforeSegment + getDistance(connectorStart, point),
          }
          if (
            !best ||
            candidate.distanceFromConnectorStart >
              best.distanceFromConnectorStart + EPS
          ) {
            best = candidate
          }
        }
      }
    }

    distanceBeforeSegment += getDistance(connectorStart, connectorEnd)
  }

  return best
}

export const trimNetLabelConnectorsAtRoutedJunctions = ({
  traces,
  netLabelPlacements,
}: {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}) =>
  traces.flatMap((connector) => {
    if (!connector.mspPairId.startsWith(GENERATED_CONNECTOR_PREFIX)) {
      return [connector]
    }

    const label = netLabelPlacements.find(
      (candidate) =>
        candidate.globalConnNetId === connector.globalConnNetId &&
        tracePathContainsPoint(connector.tracePath, candidate.anchorPoint),
    )
    if (!label) return [connector]

    const pathEndsAtAnchor = pointsEqual(
      connector.tracePath[connector.tracePath.length - 1]!,
      label.anchorPoint,
    )
    const pathStartsAtAnchor = pointsEqual(
      connector.tracePath[0]!,
      label.anchorPoint,
    )
    if (!pathEndsAtAnchor && !pathStartsAtAnchor) return [connector]

    const pathTowardAnchor = pathEndsAtAnchor
      ? connector.tracePath
      : [...connector.tracePath].reverse()
    const connectedRoutedTraces = getConnectedRoutedTraces(label, traces)
    const directHostTraces = connectedRoutedTraces.filter((trace) =>
      label.mspConnectionPairIds.includes(trace.mspPairId),
    )
    const transitivelyConnectedTraces = connectedRoutedTraces.filter(
      (trace) =>
        !label.mspConnectionPairIds.includes(trace.mspPairId) &&
        directHostTraces.some((hostTrace) =>
          tracesShareCollinearRail(hostTrace, trace),
        ),
    )
    const junction = getClosestRoutedJunctionToAnchor(
      pathTowardAnchor,
      transitivelyConnectedTraces,
    )
    if (!junction) return [connector]
    if (pointsEqual(junction.point, label.anchorPoint)) return []

    const trimmedPath = simplifyOrthogonalPath([
      junction.point,
      ...pathTowardAnchor.slice(junction.connectorSegmentIndex + 1),
    ])
    if (
      trimmedPath.length === pathTowardAnchor.length &&
      trimmedPath.every((point, index) =>
        pointsEqual(point, pathTowardAnchor[index]!),
      )
    ) {
      return [connector]
    }

    return [{ ...connector, tracePath: trimmedPath }]
  })
