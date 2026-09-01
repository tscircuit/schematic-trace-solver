import { ConnectivityMap } from "connectivity-map"
import type {
  InputChip,
  InputPin,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { getConnectivityMapsFromInputProblem } from "./getConnectivityMapFromInputProblem"

// Keep nearby ground connections, but do not extend the usual 1 mm local
// routing range vertically just because a sheet allows long signal traces.
export const MAX_LOCAL_GROUND_BRANCH_OFFSET = 1
const SAME_GROUND_PIN_BANK_AXIS_TOLERANCE = 1e-6

interface PinWithChip {
  pin: InputPin
  chip: InputChip
}

const getLocalGroundPinBanks = ({
  inputProblem,
  groundNetId,
  netConnMap,
}: {
  inputProblem: InputProblem
  groundNetId?: string
  netConnMap: ConnectivityMap
}): PinId[][] => {
  if (!groundNetId) return []

  return inputProblem.chips.flatMap((chip) => {
    const groundPins = chip.pins.filter(
      (pin) => netConnMap.getNetConnectedToId(pin.pinId) === groundNetId,
    )
    if (groundPins.length < 2) return []
    // A connector with half or more of its contacts tied to ground is a
    // deliberate ground bus. Localize only the smaller ground-pin banks found
    // on multi-function ICs.
    if (groundPins.length * 2 >= chip.pins.length) return []

    const firstPin = groundPins[0]!
    const facingDirection =
      firstPin._facingDirection ?? getPinDirection(firstPin, chip)
    const shareFacingDirection = groundPins.every(
      (pin) =>
        (pin._facingDirection ?? getPinDirection(pin, chip)) ===
        facingDirection,
    )
    if (!shareFacingDirection) return []

    let parallelCoordinates = groundPins.map((pin) => pin.y)
    let perpendicularCoordinates = groundPins.map((pin) => pin.x)
    if (facingDirection === "x-" || facingDirection === "x+") {
      parallelCoordinates = groundPins.map((pin) => pin.x)
      perpendicularCoordinates = groundPins.map((pin) => pin.y)
    }
    const parallelSpan =
      Math.max(...parallelCoordinates) - Math.min(...parallelCoordinates)
    const perpendicularSpan =
      Math.max(...perpendicularCoordinates) -
      Math.min(...perpendicularCoordinates)
    if (parallelSpan > SAME_GROUND_PIN_BANK_AXIS_TOLERANCE) return []
    if (perpendicularSpan > MAX_LOCAL_GROUND_BRANCH_OFFSET) return []

    return [groundPins.map((pin) => pin.pinId)]
  })
}

const isLongGroundPinBankConnection = ({
  firstPinId,
  secondPinId,
  groundPinBanks,
  pins,
}: {
  firstPinId: PinId
  secondPinId: PinId
  groundPinBanks: PinId[][]
  pins: Map<PinId, PinWithChip>
}) => {
  const firstPinBank = groundPinBanks.find((pinBank) =>
    pinBank.includes(firstPinId),
  )
  const secondPinBank = groundPinBanks.find((pinBank) =>
    pinBank.includes(secondPinId),
  )
  if (!firstPinBank && !secondPinBank) return false
  if (firstPinBank === secondPinBank) return false

  const firstPin = pins.get(firstPinId)?.pin
  const secondPin = pins.get(secondPinId)?.pin
  if (!firstPin || !secondPin) return false
  const orthogonalDistance =
    Math.abs(firstPin.x - secondPin.x) + Math.abs(firstPin.y - secondPin.y)
  return orthogonalDistance > MAX_LOCAL_GROUND_BRANCH_OFFSET
}

/** Avoid return wires between staggered, net-only ground-facing branches. */
export const getGroundConnectionPolicy = (inputProblem: InputProblem) => {
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const groundConnection = inputProblem.netConnections.find(
    (connection) => connection.isGround,
  )
  let groundNetId: string | undefined
  if (groundConnection) {
    groundNetId = netConnMap.getNetConnectedToId(groundConnection.netId)
  } else {
    // Older captured inputs predate `isGround`; preserve their routing while
    // current inputs use the semantic marker above.
    groundNetId = netConnMap.getNetConnectedToId("GND")
  }
  // Net identifiers do not constitute physical edges: two separate direct
  // connections may have the same netId without requesting a wire between them.
  const physicalConnMap = new ConnectivityMap({})
  const explicitlyWiredGroundNetIds = new Set<string>()
  for (const connection of inputProblem.directConnections) {
    physicalConnMap.addConnections([connection.pinIds])
    const globalNetId = netConnMap.getNetConnectedToId(connection.pinIds[0])
    const isMarkedGround = inputProblem.netConnections.some(
      (net) =>
        net.isGround &&
        netConnMap.getNetConnectedToId(net.netId) === globalNetId,
    )
    if (globalNetId && isMarkedGround) {
      explicitlyWiredGroundNetIds.add(globalNetId)
    }
  }
  const pins = new Map(
    inputProblem.chips.flatMap((chip) =>
      chip.pins.map((pin) => [pin.pinId, { pin, chip }] as const),
    ),
  )
  const groundFacingPins = [...pins.values()].filter(
    ({ pin, chip }) =>
      chip.pins.length === 2 &&
      netConnMap.getNetConnectedToId(pin.pinId) === groundNetId &&
      (pin._facingDirection ?? getPinDirection(pin, chip)) === "y-",
  )
  const groundPinBanks = getLocalGroundPinBanks({
    inputProblem,
    groundNetId,
    netConnMap,
  })
  // A deliberately wired, level bank of two-pin loads already has its own
  // shared return rail. Do not extend that rail to independent lower branches
  // just to reduce the number of GND symbols. Other ground topologies retain
  // their existing routing behavior.
  const hasExplicitParallelGroundRail = groundFacingPins.some(({ pin: a }) => {
    const group = physicalConnMap.getNetConnectedToId(a.pinId)
    return (
      group !== undefined &&
      groundFacingPins.some(
        ({ pin: b }) =>
          a.pinId !== b.pinId &&
          Math.abs(a.y - b.y) < 1e-6 &&
          Math.abs(a.x - b.x) > 1e-6 &&
          physicalConnMap.getNetConnectedToId(b.pinId) === group,
      )
    )
  })
  const areSeparateExplicitGroundIslands = (
    firstPinId: PinId,
    secondPinId: PinId,
  ) => {
    const firstGlobalNetId = netConnMap.getNetConnectedToId(firstPinId)
    const secondGlobalNetId = netConnMap.getNetConnectedToId(secondPinId)
    if (
      !firstGlobalNetId ||
      firstGlobalNetId !== secondGlobalNetId ||
      !explicitlyWiredGroundNetIds.has(firstGlobalNetId)
    ) {
      return false
    }
    const firstPhysicalGroup =
      physicalConnMap.getNetConnectedToId(firstPinId) ?? `pin:${firstPinId}`
    const secondPhysicalGroup =
      physicalConnMap.getNetConnectedToId(secondPinId) ?? `pin:${secondPinId}`
    return firstPhysicalGroup !== secondPhysicalGroup
  }
  if (!hasExplicitParallelGroundRail) {
    return (firstPinId: PinId, secondPinId: PinId) => {
      if (areSeparateExplicitGroundIslands(firstPinId, secondPinId)) {
        return false
      }
      return !isLongGroundPinBankConnection({
        firstPinId,
        secondPinId,
        groundPinBanks,
        pins,
      })
    }
  }
  const isGroundFacingTerminal = (pinId: PinId) => {
    const entry = pins.get(pinId)
    return (
      entry?.chip.pins.length === 2 &&
      !physicalConnMap.getNetConnectedToId(pinId) &&
      (entry.pin._facingDirection ?? getPinDirection(entry.pin, entry.chip)) ===
        "y-"
    )
  }

  return (firstPinId: PinId, secondPinId: PinId): boolean => {
    const firstGlobalNetId = netConnMap.getNetConnectedToId(firstPinId)
    const secondGlobalNetId = netConnMap.getNetConnectedToId(secondPinId)
    if (areSeparateExplicitGroundIslands(firstPinId, secondPinId)) return false
    if (
      isLongGroundPinBankConnection({
        firstPinId,
        secondPinId,
        groundPinBanks,
        pins,
      })
    ) {
      return false
    }
    if (
      !groundNetId ||
      firstGlobalNetId !== groundNetId ||
      secondGlobalNetId !== groundNetId
    ) {
      return true
    }
    if (
      !isGroundFacingTerminal(firstPinId) &&
      !isGroundFacingTerminal(secondPinId)
    )
      return true
    const first = pins.get(firstPinId)?.pin
    const second = pins.get(secondPinId)?.pin
    // Level ground pins can still form a shared decoupling rail. A staggered
    // terminal would need a return detour; use its local GND label instead.
    return (
      !first ||
      !second ||
      Math.abs(first.y - second.y) <= MAX_LOCAL_GROUND_BRANCH_OFFSET + 1e-6
    )
  }
}
