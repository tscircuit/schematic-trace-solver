import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"

/**
 * Returns true when a group of pins (the pins of one connectivity net) should
 * NOT be routed as traces and should instead only receive net labels.
 *
 * This targets the repro61 situation (issue #79): passive two-terminal
 * components (e.g. decoupling capacitors) whose pins are joined exclusively
 * through net labels. Drawing a trace between such pins makes the passives
 * look hard-wired in parallel and produces a redundant trace alongside the
 * net labels.
 *
 * The check is deliberately narrow so that nets which mix net labels with
 * real wiring (or that connect multi-pin chips / ports) keep being routed:
 *   1. No pin in the group participates in any direct (wire) connection.
 *   2. Every pin in the group belongs to a two-pin (passive) chip.
 *   3. None of those chips has any directly-wired pin (the chips are joined
 *      to the rest of the schematic exclusively through net labels).
 */
export const isNetLabelOnlyPassivePinGroup = (params: {
  inputProblem: InputProblem
  pinIdsInNet: PinId[]
}): boolean => {
  const { inputProblem, pinIdsInNet } = params

  if (pinIdsInNet.length < 2) return false

  const directWirePinIds = new Set<PinId>()
  for (const directConn of inputProblem.directConnections) {
    for (const pinId of directConn.pinIds) {
      directWirePinIds.add(pinId)
    }
  }

  const chipByPinId = new Map<PinId, InputChip>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      chipByPinId.set(pin.pinId, chip)
    }
  }

  for (const pinId of pinIdsInNet) {
    // 1. The net must be net-label-only (no direct/wire connections)
    if (directWirePinIds.has(pinId)) return false

    const chip = chipByPinId.get(pinId)
    if (!chip) continue

    // 2. Only passive two-terminal components qualify
    if (chip.pins.length !== 2) return false

    // 3. The chip itself must not be wired to anything
    if (chip.pins.some((pin) => directWirePinIds.has(pin.pinId))) return false
  }

  return true
}
