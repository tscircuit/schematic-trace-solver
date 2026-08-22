import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Groups NetLabelPlacement objects by their associated chip ID and orientation.
 * Labels are grouped if they belong to the same chip and are positioned
 * with the same orientation relative to that chip.
 *
 * @param labels An array of NetLabelPlacement objects to be grouped.
 * @param chips Chips from the input problem, used to resolve opaque pin IDs to
 * their owning component.
 * @returns A record where keys are in the format "chipId-orientation" (e.g., "U1-left")
 *          and values are arrays of NetLabelPlacement objects belonging to that group.
 */
export const groupLabelsByChipAndOrientation = ({
  labels,
  chips,
}: {
  labels: NetLabelPlacement[]
  chips: InputProblem["chips"]
}): Record<string, NetLabelPlacement[]> => {
  const groupedLabels: Record<string, NetLabelPlacement[]> = {}
  const chipIdByPinId = new Map(
    chips.flatMap((chip) =>
      chip.pins.map((pin) => [pin.pinId, chip.chipId] as const),
    ),
  )

  for (const label of labels) {
    if (label.pinIds.length === 0) {
      // Labels without pinIds cannot be associated with a chip and orientation for merging
      continue
    }

    const pinId = label.pinIds[0]!
    // Preserve historical group IDs for component-qualified pins while using
    // the input's pin ownership for opaque IDs such as schematic_port_123.
    const legacyChipId = pinId.includes(".") ? pinId.split(".")[0] : undefined
    const chipId = legacyChipId ?? chipIdByPinId.get(pinId)
    if (!chipId) {
      continue
    }

    const key = `${chipId}-${label.orientation}`

    if (!groupedLabels[key]) {
      groupedLabels[key] = []
    }
    groupedLabels[key].push(label)
  }

  return groupedLabels
}
