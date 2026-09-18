import { NetLabelNetLabelCollisionSolver } from "../NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import { ConnectivityMap } from "connectivity-map"
import type { InputProblem } from "lib/types/InputProblem"
import { getConnectivityMapsFromInputProblem } from "../MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import {
  NetLabelPlacementSolver,
  type NetLabelPlacement,
} from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getAdverseTravelToRail } from "./getAdverseTravelToRail"

const MAX_ADVERSE_RAIL_TRAVEL = 1
const MAX_VERTICAL_RAIL_TRAVEL = 4
const EPS = 1e-6

/** Evaluate recovery toward the shared rail label, not toward the other pin. */
export const getRailRecoveryPolicy = (inputProblem: InputProblem) => {
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const orientations = new Map<string, "y+" | "y-">()
  for (const [netId, available] of Object.entries(
    inputProblem.availableNetLabelOrientations,
  )) {
    const globalNetId = netConnMap.getNetConnectedToId(netId)
    if (
      globalNetId &&
      available.length === 1 &&
      (available[0] === "y+" || available[0] === "y-")
    ) {
      orientations.set(globalNetId, available[0])
    }
  }
  const physicalConnMap = new ConnectivityMap({})
  for (const connection of inputProblem.directConnections) {
    if (connection.netLabelWidth === undefined)
      physicalConnMap.addConnections([connection.pinIds])
  }

  return ({
    trace,
    existingTraces,
    retainedLabels,
  }: {
    trace: SolvedTracePath
    existingTraces: SolvedTracePath[]
    retainedLabels?: NetLabelPlacement[]
  }): boolean => {
    const [first, second] = trace.pins
    if (first.chipId === second.chipId) return true
    const orientation = orientations.get(trace.globalConnNetId)
    if (!orientation) return true
    const physicalNetId = physicalConnMap.getNetConnectedToId(first.pinId)
    if (
      physicalNetId &&
      physicalNetId === physicalConnMap.getNetConnectedToId(second.pinId)
    )
      return true

    // Use the same representative trace and label placement as the pipeline.
    // No endpoint-height prefilter: descending into GND (or ascending into
    // power) can be correct even when both terminals are initially isolated.
    const traces = [...existingTraces, trace]
    const placement = new NetLabelPlacementSolver({
      inputProblem,
      inputTraceMap: Object.fromEntries(traces.map((t) => [t.mspPairId, t])),
    })
    const group = placement.overlappingSameNetTraceGroups.find((group) =>
      group.mspConnectionPairIds?.includes(trace.mspPairId),
    )
    if (!group) return true
    const groupTraceIds = new Set(group.mspConnectionPairIds)
    const groupTraces = traces.filter((t) => groupTraceIds.has(t.mspPairId))
    const groupPinIds = new Set(groupTraces.flatMap((t) => t.pinIds))
    let labels: NetLabelPlacement[]
    if (retainedLabels) {
      labels = retainedLabels.filter(
        (label) =>
          label.globalConnNetId === trace.globalConnNetId &&
          label.pinIds.some((id) => groupPinIds.has(id)),
      )
    } else {
      placement.solve()
      // A preliminary anchor may collide with a neighboring terminal label.
      // Include collision relocation before measuring travel toward it.
      const collision = new NetLabelNetLabelCollisionSolver({
        inputProblem,
        traces,
        netLabelPlacements: placement.netLabelPlacements,
      })
      collision.solve()
      labels = collision.outputNetLabelPlacements.filter((label) =>
        label.mspConnectionPairIds.some((id) => groupTraceIds.has(id)),
      )
    }
    // If placement fails, leave recovery to the existing fallback mechanisms.
    if (labels.length === 0) return true
    return trace.pins.every(
      (pin) =>
        getAdverseTravelToRail({
          paths: groupTraces.map((t) => t.tracePath),
          source: pin,
          anchors: labels.map((label) => label.anchorPoint),
          orientation,
          maxVerticalTravel: MAX_VERTICAL_RAIL_TRAVEL,
        }) <=
        MAX_ADVERSE_RAIL_TRAVEL + EPS,
    )
  }
}
