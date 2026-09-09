import type { ConnectivityMap } from "connectivity-map"
import type { InputPin, InputProblem, PinId } from "lib/types/InputProblem"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"

const EPS = 1e-6
// Component scale supplies a minimum allowance, including two-capacitor rows
// with no neighboring pitch to compare against.
const MAX_RAIL_SPACING_IN_TERMINAL_SPANS = 4
const MAX_RAIL_SPACING_MULTIPLIER = 2

export const getRailPairKey = (first: PinId, second: PinId) =>
  JSON.stringify([first, second].sort())

/** Adjacent, outward-facing terminals can share a straight decoupling rail. */
export const getParallelRailPairs = (
  inputProblem: InputProblem,
  netConnMap: ConnectivityMap,
  maxMspPairDistance: number,
) => {
  const groundNetIds = new Set<string>()
  const namedPinIds = new Set<PinId>()
  const wiredPinIds = new Set<PinId>()
  for (const connection of inputProblem.netConnections) {
    for (const pinId of connection.pinIds) namedPinIds.add(pinId)
    const netId = netConnMap.getNetConnectedToId(connection.netId)
    if (netId && connection.isGround) {
      groundNetIds.add(netId)
    }
  }
  for (const connection of inputProblem.directConnections) {
    const pinIds =
      connection.netLabelWidth === undefined ? wiredPinIds : namedPinIds
    for (const pinId of connection.pinIds) pinIds.add(pinId)
  }

  const rows: Array<{
    sectionId?: string
    direction: string
    coordinate: number
    axis: "x" | "y"
    pins: Array<InputPin & { chipId: string; oppositeCoordinate: number }>
  }> = []
  for (const chip of inputProblem.chips) {
    if (
      chip.pins.length !== 2 ||
      (chip.symbolName && !chip.symbolName.startsWith("capacitor")) ||
      !chip.pins.every((pin) => namedPinIds.has(pin.pinId)) ||
      chip.pins.some((pin) => wiredPinIds.has(pin.pinId))
    )
      continue
    const nets = chip.pins.map((pin) =>
      netConnMap.getNetConnectedToId(pin.pinId),
    )
    if (
      !nets[0] ||
      !nets[1] ||
      nets[0] === nets[1] ||
      groundNetIds.has(nets[0]) === groundNetIds.has(nets[1])
    )
      continue
    const directions = chip.pins.map(
      (pin) => pin._facingDirection ?? getPinDirection(pin, chip),
    )
    if (
      directions[0]![0] !== directions[1]![0] ||
      directions[0] === directions[1]
    )
      continue
    const axis = directions[0]![0] as "x" | "y"
    const along = axis === "x" ? "y" : "x"
    if (Math.abs(chip.pins[0]![along] - chip.pins[1]![along]) > EPS) continue

    for (const [index, pin] of chip.pins.entries()) {
      const direction = directions[index]!
      let row = rows.find(
        (candidate) =>
          candidate.sectionId === chip.sectionId &&
          candidate.direction === direction &&
          Math.abs(candidate.coordinate - pin[axis]) <= EPS,
      )
      if (!row) {
        row = {
          sectionId: chip.sectionId,
          direction,
          coordinate: pin[axis],
          axis,
          pins: [],
        }
        rows.push(row)
      }
      row.pins.push({
        ...pin,
        chipId: chip.chipId,
        oppositeCoordinate: chip.pins[1 - index]![axis],
      })
    }
  }

  const pairKeys = new Set<string>()
  const extendedRailPinIds = new Set<PinId>()
  const separatedRailPinIds = new Set<PinId>()
  for (const row of rows) {
    const along = row.axis === "x" ? "y" : "x"
    row.pins.sort(
      (a, b) => a[along] - b[along] || a.pinId.localeCompare(b.pinId),
    )
    for (let index = 1; index < row.pins.length; index++) {
      const first = row.pins[index - 1]!
      const second = row.pins[index]!
      const spacing = second[along] - first[along]
      // A regular row may be widely spaced. Split at gaps that are much
      // larger than the neighboring pitch, rather than imposing a fixed cap.
      const neighboringSpacings = [
        first[along] - (row.pins[index - 2]?.[along] ?? first[along]),
        (row.pins[index + 1]?.[along] ?? second[along]) - second[along],
      ].filter((gap) => gap > EPS)
      const maxRailSpacing = Math.max(
        MAX_RAIL_SPACING_MULTIPLIER * maxMspPairDistance,
        MAX_RAIL_SPACING_MULTIPLIER *
          (neighboringSpacings.length ? Math.min(...neighboringSpacings) : 0),
        MAX_RAIL_SPACING_IN_TERMINAL_SPANS *
          Math.max(
            Math.abs(first[row.axis] - first.oppositeCoordinate),
            Math.abs(second[row.axis] - second.oppositeCoordinate),
          ),
      )
      // A different supply in between ends the supply rail; GND can continue.
      if (
        spacing <= EPS ||
        netConnMap.getNetConnectedToId(first.pinId) !==
          netConnMap.getNetConnectedToId(second.pinId)
      )
        continue
      if (spacing > maxRailSpacing + EPS) {
        // Recovery must retain this separation even when each capacitor has
        // a different supply and does not belong to a same-net branch bank.
        separatedRailPinIds.add(first.pinId)
        separatedRailPinIds.add(second.pinId)
        continue
      }
      // A component between the terminals breaks the row. Leave obstacle
      // detours to ordinary local routing instead of extending this exception.
      const minAcross = Math.min(
        first[row.axis],
        second[row.axis],
        first.oppositeCoordinate,
        second.oppositeCoordinate,
      )
      const maxAcross = Math.max(
        first[row.axis],
        second[row.axis],
        first.oppositeCoordinate,
        second.oppositeCoordinate,
      )
      if (
        inputProblem.chips.some((chip) => {
          if (chip.chipId === first.chipId || chip.chipId === second.chipId)
            return false
          const acrossSize = row.axis === "x" ? chip.width : chip.height
          const alongSize = along === "x" ? chip.width : chip.height
          return (
            chip.center[row.axis] + acrossSize / 2 >= minAcross - EPS &&
            chip.center[row.axis] - acrossSize / 2 <= maxAcross + EPS &&
            chip.center[along] + alongSize / 2 > first[along] + EPS &&
            chip.center[along] - alongSize / 2 < second[along] - EPS
          )
        })
      )
        continue
      pairKeys.add(getRailPairKey(first.pinId, second.pinId))
      if (spacing > maxMspPairDistance) {
        extendedRailPinIds.add(first.pinId)
        extendedRailPinIds.add(second.pinId)
      }
    }
  }
  return { pairKeys, extendedRailPinIds, separatedRailPinIds }
}
