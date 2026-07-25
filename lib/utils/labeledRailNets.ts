import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { DEFAULT_MAX_MSP_PAIR_DISTANCE } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"

/**
 * Nets that declare net-label orientations (power/ground rails and named buses
 * like V3_3, GND, SDA) get a net label drawn at every pin once the net has more
 * than two pins. Wiring a distant pair on such a net duplicates information
 * that the labels already carry, and the resulting bus trace snakes across the
 * schematic (#670).
 *
 * `isLabeledRailNet` reports whether a pin sits on such a net: it declares
 * available net-label orientations and has more than two pins, so every pin
 * really does get a label. A two-pin labeled net is excluded because one trace
 * is cleaner than a floating label pair (see rotated-components-rail-label).
 *
 * `exceedsDirectWiringDistance` compares a length against `maxMspPairDistance`,
 * the same threshold `MspConnectionPairSolver` uses to decide a pair is too far
 * apart to wire directly. Callers pass whichever length is meaningful for them:
 * the straight-line pin distance when choosing candidate pairs, or the routed
 * path length when a detour around obstacles is what makes a trace long.
 */
export const createLabeledRailNetHelpers = (inputProblem: InputProblem) => {
  const labeledNetIds = new Set(
    Object.keys(inputProblem.availableNetLabelOrientations ?? {}),
  )
  const maxPairDistance =
    inputProblem.maxMspPairDistance ?? DEFAULT_MAX_MSP_PAIR_DISTANCE

  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

  const pinIds = new Set<PinId>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) pinIds.add(pin.pinId)
  }

  const labeledNetCache = new Map<string, boolean>()

  const netIsLabeled = (pinId: PinId): boolean => {
    const netId = netConnMap.getNetConnectedToId(pinId)
    if (!netId) return false

    const cached = labeledNetCache.get(netId)
    if (cached !== undefined) return cached

    const idsInNet = netConnMap.getIdsConnectedToNet(netId)
    const pinCount = idsInNet.filter((id) => pinIds.has(id)).length
    const declaresLabels = idsInNet.some((id) => labeledNetIds.has(id))

    const isLabeled = pinCount > 2 && declaresLabels
    labeledNetCache.set(netId, isLabeled)
    return isLabeled
  }

  return {
    isLabeledRailNet: (pinId: PinId): boolean => netIsLabeled(pinId),
    exceedsDirectWiringDistance: (length: number): boolean =>
      length > maxPairDistance,
  }
}
