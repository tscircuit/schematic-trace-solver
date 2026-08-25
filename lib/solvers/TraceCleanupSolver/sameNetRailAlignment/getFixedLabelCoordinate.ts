import { distance } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getDistinctCoordinates, RAIL_ALIGNMENT_EPSILON } from "./geometry"
import type { RailSegment } from "./types"

const getTransitivelyConnectedTraceIds = (
  group: RailSegment[],
  traces: SolvedTracePath[],
) => {
  const groupNetId = group[0]!.globalConnNetId
  const sameNetTraces = traces.filter(
    (trace) => trace.globalConnNetId === groupNetId,
  )
  const connectedTraceIds = new Set(group.map((segment) => segment.traceId))
  const connectedPinIds = new Set(
    sameNetTraces
      .filter((trace) => connectedTraceIds.has(trace.mspPairId))
      .flatMap((trace) => trace.pinIds),
  )

  for (let changed = true; changed; ) {
    changed = false
    for (const trace of sameNetTraces) {
      if (connectedTraceIds.has(trace.mspPairId)) continue
      if (!trace.pinIds.some((pinId) => connectedPinIds.has(pinId))) continue

      connectedTraceIds.add(trace.mspPairId)
      for (const pinId of trace.pinIds) connectedPinIds.add(pinId)
      changed = true
    }
  }

  return connectedTraceIds
}

const getLabelsLinkedToRailGroup = (
  group: RailSegment[],
  netLabelPlacements: NetLabelPlacement[],
  traces: SolvedTracePath[],
) => {
  const traceIds = getTransitivelyConnectedTraceIds(group, traces)
  return netLabelPlacements.filter((label) =>
    label.mspConnectionPairIds.some((traceId) => traceIds.has(traceId)),
  )
}

export const getFixedLabelCoordinate = (
  group: RailSegment[],
  netLabelPlacements: NetLabelPlacement[],
  traces: SolvedTracePath[],
) => {
  const traceMap = new Map(traces.map((trace) => [trace.mspPairId, trace]))
  const groupTraceIds = new Set(group.map((segment) => segment.traceId))
  const groupHasOnlySingleRailTraces = [...groupTraceIds].every(
    (traceId) => traceMap.get(traceId)?.tracePath.length === 4,
  )
  // A fixed label may lengthen the endpoint legs around one movable rail. A
  // trace with more elbows still has to pass the normal readability scoring.
  if (!groupHasOnlySingleRailTraces) return null

  const orientation = group[0]!.orientation
  const coordinates = getDistinctCoordinates(
    getLabelsLinkedToRailGroup(group, netLabelPlacements, traces)
      .filter(
        (label) =>
          label.orientation === group[0]!.componentFacingDirection &&
          label.mspConnectionPairIds.some((traceId) => {
            const trace = traceMap.get(traceId)
            return (
              trace &&
              tracePathContainsPoint(trace.tracePath, label.anchorPoint)
            )
          }),
      )
      .map((label) =>
        orientation === "vertical" ? label.anchorPoint.x : label.anchorPoint.y,
      ),
  )
  if (coordinates.length !== 1) return null

  const coordinate = coordinates[0]!
  // Rail cleanup is local: a label cannot pull a connection farther than the
  // span of the pins that connection already joins.
  const coordinateIsLocalToEveryTrace = group.every((segment) => {
    const trace = traceMap.get(segment.traceId)
    if (!trace) return false
    return (
      Math.abs(segment.coordinate - coordinate) <=
      distance(trace.pins[0]!, trace.pins[1]!) + RAIL_ALIGNMENT_EPSILON
    )
  })
  return coordinateIsLocalToEveryTrace ? coordinate : null
}
