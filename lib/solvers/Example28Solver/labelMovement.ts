import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { getMovedAnchorPointForReroute } from "./getMovedAnchorPointForReroute"
import { isLabelAttachedToTrace } from "./isLabelAttachedToTrace"
import { trimNetLabelConnectorsAtRoutedJunctions } from "./trimNetLabelConnectorsAtRoutedJunctions"

export const moveAttachedLabelsToReroutedTrace = ({
  trace,
  originalTracePath,
  reroutedTracePath,
  netLabelPlacements,
}: {
  trace: SolvedTracePath
  originalTracePath: Point[]
  reroutedTracePath: Point[]
  netLabelPlacements: NetLabelPlacement[]
}) =>
  netLabelPlacements.map((label) => {
    if (!isLabelAttachedToTrace(label, trace)) return label

    const movedAnchorPoint = getMovedAnchorPointForReroute(
      label.anchorPoint,
      originalTracePath,
      reroutedTracePath,
    )
    if (!movedAnchorPoint) return label

    const delta = {
      x: movedAnchorPoint.x - label.anchorPoint.x,
      y: movedAnchorPoint.y - label.anchorPoint.y,
    }

    return {
      ...label,
      anchorPoint: movedAnchorPoint,
      center: {
        x: label.center.x + delta.x,
        y: label.center.y + delta.y,
      },
    }
  })

export const moveNetLabelConnectorsToReroutedTraces = ({
  originalTraces,
  reroutedTraces,
  netLabelPlacements,
}: {
  originalTraces: SolvedTracePath[]
  reroutedTraces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  const traces = [...reroutedTraces]
  const reroutedTraceMap = new Map(
    reroutedTraces.map((trace) => [trace.mspPairId, trace]),
  )

  const labels = netLabelPlacements.map((label) => {
    const originalHostTrace = originalTraces.find((trace) => {
      if (!label.mspConnectionPairIds.includes(trace.mspPairId)) return false
      const reroutedTrace = reroutedTraceMap.get(trace.mspPairId)
      if (!reroutedTrace) return false
      return reroutedTrace.tracePath !== trace.tracePath
    })
    if (!originalHostTrace) return label

    const reroutedHostTrace = reroutedTraceMap.get(originalHostTrace.mspPairId)!
    const connectorIndex = originalTraces.findIndex((trace) => {
      if (trace.mspPairId === originalHostTrace.mspPairId) return false
      if (trace.globalConnNetId !== label.globalConnNetId) return false
      if (!tracePathContainsPoint(trace.tracePath, label.anchorPoint)) {
        return false
      }
      return label.pinIds.every((pinId) => trace.pinIds.includes(pinId))
    })
    if (connectorIndex < 0) return label

    const connector = originalTraces[connectorIndex]!
    const originalJunction = connector.tracePath.find((point) =>
      tracePathContainsPoint(originalHostTrace.tracePath, point),
    )
    if (!originalJunction) return label

    const reroutedJunction = getMovedAnchorPointForReroute(
      originalJunction,
      originalHostTrace.tracePath,
      reroutedHostTrace.tracePath,
    )
    if (!reroutedJunction) return label

    const delta = {
      x: reroutedJunction.x - originalJunction.x,
      y: reroutedJunction.y - originalJunction.y,
    }
    const movedConnector = {
      ...connector,
      tracePath: connector.tracePath.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y,
      })),
    }
    traces[connectorIndex] = movedConnector
    return moveAttachedLabelsToReroutedTrace({
      trace: connector,
      originalTracePath: connector.tracePath,
      reroutedTracePath: movedConnector.tracePath,
      netLabelPlacements: [label],
    })[0]!
  })

  return {
    traces: trimNetLabelConnectorsAtRoutedJunctions({
      traces,
      netLabelPlacements: labels,
    }),
    netLabelPlacements: labels,
  }
}
