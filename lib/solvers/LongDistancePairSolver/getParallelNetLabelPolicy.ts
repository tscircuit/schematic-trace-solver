import { ConnectivityMap } from "connectivity-map"
import type { InputPin, InputProblem, PinId } from "lib/types/InputProblem"
import { DEFAULT_MAX_MSP_PAIR_DISTANCE } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { getParallelRailPairs } from "../MspConnectionPairSolver/getParallelRailPairs"

/** Keep distant parallel rail/ground branches local during trace recovery. */
export const getParallelNetLabelPolicy = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
  connectedPinIds: ReadonlySet<PinId>,
) => {
  const maxDistance =
    inputProblem.maxMspPairDistance ?? DEFAULT_MAX_MSP_PAIR_DISTANCE
  const { extendedRailPinIds } = getParallelRailPairs(
    inputProblem,
    netConnMap,
    maxDistance,
  )
  const groundNetIds = new Set<string>()
  const namedPinIds = new Set<PinId>()
  for (const connection of inputProblem.netConnections) {
    const netId = netConnMap.getNetConnectedToId(connection.netId)
    if (!netId) continue
    for (const pinId of connection.pinIds) namedPinIds.add(pinId)
    if (connection.isGround || connection.netId === "GND") {
      groundNetIds.add(netId)
    }
  }

  // Older inputs omit symbol metadata. Identify parallel two-terminal
  // branches by their two named nets, without inferring capacitor types or
  // requiring identical pin positions, sizes, or orientations.
  const banks = new Map<string, PinId[][]>()
  for (const chip of inputProblem.chips) {
    // Preserve branches that use source wires or already participate in
    // local routing. This policy only selects standalone named-net branches.
    if (
      chip.pins.length !== 2 ||
      !chip.pins.every((pin) => namedPinIds.has(pin.pinId)) ||
      chip.pins.some(
        (pin) =>
          connectedPinIds.has(pin.pinId) && !extendedRailPinIds.has(pin.pinId),
      )
    )
      continue
    const [first, second] = chip.pins.map((pin) =>
      netConnMap.getNetConnectedToId(pin.pinId),
    )
    if (
      !first ||
      !second ||
      first === second ||
      groundNetIds.has(first) === groundNetIds.has(second)
    ) {
      continue
    }
    const key = JSON.stringify([
      chip.sectionId ?? null,
      ...[first, second].sort(),
    ])
    const bank = banks.get(key) ?? []
    bank.push(chip.pins.map((pin) => pin.pinId))
    banks.set(key, bank)
  }
  const bankPinIds = new Set(
    [...banks.values()].filter((bank) => bank.length > 1).flat(2),
  )
  // A shared rail remains local to its row. Do not recover wires from it to
  // distant IC pins or another row just because its terminals now have traces.
  for (const pinId of extendedRailPinIds) {
    bankPinIds.add(pinId)
  }

  // Explicit source wires may be recovered even beyond the local distance.
  // Sharing a net ID alone does not request a physical wire between branches.
  const physicalConnMap = new ConnectivityMap({})
  for (const connection of inputProblem.directConnections) {
    if (connection.netLabelWidth === undefined) {
      physicalConnMap.addConnections([connection.pinIds])
    }
  }

  return (first: InputPin, second: InputPin): boolean => {
    if (!bankPinIds.has(first.pinId) && !bankPinIds.has(second.pinId))
      return true
    if (
      Math.abs(first.x - second.x) + Math.abs(first.y - second.y) <=
      maxDistance
    ) {
      return true
    }
    const physicalNetId = physicalConnMap.getNetConnectedToId(first.pinId)
    return (
      physicalNetId !== undefined &&
      physicalNetId === physicalConnMap.getNetConnectedToId(second.pinId)
    )
  }
}
