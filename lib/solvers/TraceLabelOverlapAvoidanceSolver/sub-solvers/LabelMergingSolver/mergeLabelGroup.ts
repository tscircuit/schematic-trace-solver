import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "../../../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { Point } from "graphics-debug" // Assuming Point is from graphics-debug or similar

/**
 * Merges a group of NetLabelPlacement objects into a single, larger NetLabelPlacement.
 * It calculates a new bounding box that encompasses all labels in the group,
 * aggregates unique pin and MSP connection pair IDs, and creates a synthetic
 * merged label.
 *
 * @param group An array of NetLabelPlacement objects to be merged. Assumes the group is not empty.
 * @param groupKey A string key representing the group (e.g., "chip1-left"), used for generating the merged label's globalConnNetId.
 * @returns An object containing the newly created merged NetLabelPlacement and a Set of the original globalConnNetIds that were merged.
 * @throws Error if the input group is empty.
 */
export const mergeLabelGroup = (
  group: NetLabelPlacement[],
  groupKey: string,
): {
  mergedLabel: NetLabelPlacement
  originalNetIds: Set<string>
} => {
  if (group.length === 0) {
    throw new Error("Cannot merge an empty group of labels.")
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const allPinIds = new Set<string>()
  const allMspConnectionPairIds = new Set<string>()
  const originalNetIds = new Set<string>()

  for (const label of group) {
    const bounds = getRectBounds(label.center, label.width, label.height)
    minX = Math.min(minX, bounds.minX)
    minY = Math.min(minY, bounds.minY)
    maxX = Math.max(maxX, bounds.maxX)
    maxY = Math.max(maxY, bounds.maxY)

    label.pinIds.forEach((id) => allPinIds.add(id))
    label.mspConnectionPairIds.forEach((id) => allMspConnectionPairIds.add(id))
    originalNetIds.add(label.globalConnNetId)
  }

  const newWidth = maxX - minX
  const newHeight = maxY - minY
  const newCenter: Point = { x: minX + newWidth / 2, y: minY + newHeight / 2 }

  // Use the first label as a template for properties that are consistent across the group
  // like orientation.
  const template = group[0]!
  const syntheticId = `merged-group-${groupKey}`

  const mergedLabel: NetLabelPlacement = {
    ...template, // Copy common properties
    globalConnNetId: syntheticId,
    center: newCenter,
    width: newWidth,
    height: newHeight,
    pinIds: Array.from(allPinIds),
    mspConnectionPairIds: Array.from(allMspConnectionPairIds),
  }

  return {
    mergedLabel,
    originalNetIds,
  }
}
