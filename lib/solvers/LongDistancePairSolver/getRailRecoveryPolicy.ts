import type { Point } from "@tscircuit/math-utils"
import { ConnectivityMap } from "connectivity-map"
import type { InputPin, InputProblem, PinId } from "lib/types/InputProblem"
import { getConnectivityMapsFromInputProblem } from "../MspConnectionPairSolver/getConnectivityMapFromInputProblem"

const MAX_POWER_RAIL_VERTICAL_OFFSET = 0.2
const MAX_GROUND_RAIL_VERTICAL_OFFSET = 1
const EPS = 1e-6

/** Prefer local labels to automatic rail joins at substantially different heights. */
export const getRailRecoveryPolicy = (
  inputProblem: InputProblem,
  connectedPinIds: ReadonlySet<PinId>,
) => {
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const limits = new Map<string, number>()
  for (const [netId, orientations] of Object.entries(
    inputProblem.availableNetLabelOrientations,
  )) {
    // A vertical rail is identified by its required orientation, not its name.
    // Leave signals and deliberately rotated rails alone.
    if (orientations.length !== 1) continue
    const limit =
      orientations[0] === "y+"
        ? MAX_POWER_RAIL_VERTICAL_OFFSET
        : orientations[0] === "y-"
          ? MAX_GROUND_RAIL_VERTICAL_OFFSET
          : undefined
    const globalNetId = netConnMap.getNetConnectedToId(netId)
    if (limit !== undefined && globalNetId) {
      limits.set(
        globalNetId,
        Math.min(limits.get(globalNetId) ?? Infinity, limit),
      )
    }
  }

  // Only actual source wires establish an override. Sharing a netId does not
  // request a wire between otherwise separate components or ground islands.
  const physicalConnMap = new ConnectivityMap({})
  for (const connection of inputProblem.directConnections) {
    if (connection.netLabelWidth === undefined) {
      physicalConnMap.addConnections([connection.pinIds])
    }
  }

  const chipByPinId = new Map(
    inputProblem.chips.flatMap((chip) =>
      chip.pins.map((pin) => [pin.pinId, chip.chipId] as const),
    ),
  )

  return (
    first: InputPin,
    second: InputPin,
    tracePath?: ReadonlyArray<Point>,
  ): boolean => {
    // A component's own multi-pin bus is not a detour to a remote rail.
    const firstChipId = chipByPinId.get(first.pinId)
    if (
      firstChipId !== undefined &&
      firstChipId === chipByPinId.get(second.pinId)
    )
      return true
    const globalNetId = netConnMap.getNetConnectedToId(first.pinId)
    const limit = globalNetId ? limits.get(globalNetId) : undefined
    if (limit === undefined) return true
    const physicalNetId = physicalConnMap.getNetConnectedToId(first.pinId)
    if (
      physicalNetId &&
      physicalNetId === physicalConnMap.getNetConnectedToId(second.pinId)
    ) {
      return true
    }
    // When joining an existing rail, measure travel from the isolated pin to
    // that rail. Upward travel to power and downward travel to ground are fine.
    const firstConnected = connectedPinIds.has(first.pinId)
    const secondConnected = connectedPinIds.has(second.pinId)
    const isPower = limit === MAX_POWER_RAIL_VERTICAL_OFFSET
    const sourceY =
      firstConnected !== secondConnected
        ? (firstConnected ? second : first).y
        : isPower
          ? Math.max(first.y, second.y)
          : Math.min(first.y, second.y)
    // With two isolated terminals neither endpoint owns an existing rail.
    // Apply the limit in both orders so reversing recovery cannot bypass it.
    // Check the routed path too: an obstacle detour can travel the wrong way
    // even when both endpoints are level.
    const ys = tracePath?.map((point) => point.y) ?? [first.y, second.y]
    const adverseTravel = isPower
      ? sourceY - Math.min(...ys)
      : Math.max(...ys) - sourceY
    return adverseTravel <= limit + EPS
  }
}
