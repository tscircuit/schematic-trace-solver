import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Groups NetLabelPlacement objects by their associated chip ID and orientation.
 * Labels are grouped if they belong to the same chip and are positioned
 * with the same orientation relative to that chip.
 *
 * @param labels An array of NetLabelPlacement objects to be grouped.
 * @param chips An array of Chip objects from the InputProblem. (Currently not directly used for grouping logic, but part of the signature).
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

  for (const label of labels) {
    if (label.pinIds.length === 0) {
      // Labels without pinIds cannot be associated with a chip and orientation for merging
      continue
    }

    // Extract chipId from the first pinId (e.g., "U1.1" -> "U1")
    const chipId = label.pinIds[0].split(".")[0]
    if (!chipId) {
      // Should not happen if pinIds are well-formed, but good to guard
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
