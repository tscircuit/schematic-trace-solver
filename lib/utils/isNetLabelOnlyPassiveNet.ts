import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"

/**
 * Returns true when a group of same-net pins should NOT be connected with
 * wire traces and should instead be represented purely by net labels.
 *
 * This targets the repro61 case (issue #79): passive two-terminal components
 * (e.g. parallel decoupling capacitors) whose pins are joined exclusively
 * through net labels. Routing a wire between such pins is redundant — every
 * pin already gets a net label — and it makes independently-labeled
 * components look hard-wired together (see tscircuit/core#1503).
 *
 * The check is intentionally narrow so that nets which mix net labels with
 * real (direct) wiring, or that involve multi-pin chips, continue to be
 * routed exactly as before:
 *
 *   1. No pin in the group participates in any direct (wire) connection.
 *   2. Every pin in the group belongs to a two-pin passive component.
 *   3. None of those components has any directly-wired pin, i.e. the
 *      components are attached to the schematic exclusively via net labels.
 */
export const isNetLabelOnlyPassiveNet = (params: {
  inputProblem: InputProblem
  pinIds: PinId[]
}): boolean => {
  const { inputProblem, pinIds } = params

  if (pinIds.length < 2) return false

  const directlyWiredPinIds = new Set<PinId>()
  for (const directConnection of inputProblem.directConnections) {
    for (const pinId of directConnection.pinIds) {
      directlyWiredPinIds.add(pinId)
    }
  }

  const chipByPinId = new Map<PinId, InputChip>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      chipByPinId.set(pin.pinId, chip)
    }
  }

  const chipIdsInNet = new Set<string>()

  for (const pinId of pinIds) {
    // 1. The group must be net-label-only (no direct/wire connections)
    if (directlyWiredPinIds.has(pinId)) return false

    const chip = chipByPinId.get(pinId)
    if (!chip) continue
    chipIdsInNet.add(chip.chipId)

    // 2. Only two-pin passive components qualify
    if (chip.pins.length !== 2) return false

    // 3. The component itself must not be wired to anything else
    for (const pin of chip.pins) {
      if (directlyWiredPinIds.has(pin.pinId)) return false
    }
  }

  // 4. Only skip wiring when the net spans multiple components: same-net
  // pins on a single component (e.g. repro142) should still get a stub
  // trace and a single shared net label.
  if (chipIdsInNet.size < 2) return false

  return true
}
