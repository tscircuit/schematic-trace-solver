import type { Bounds } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
  NET_LABEL_HORIZONTAL_HEIGHT,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

/**
 * Returns the visible schematic-world bounds of a conventional net label.
 *
 * Horizontal labels render as tags whose text remains horizontal. Rail inputs
 * encode their vertical-symbol dimensions in width/height, so a rail label
 * that later falls back to an x-facing tag can have those extents transposed.
 * Normalize that tag to the renderer's horizontal envelope before using it as
 * an obstacle.
 */
export const getAnchoredNetLabelRenderedBounds = (
  placement: NetLabelPlacement,
): Bounds => {
  if (placement.orientation !== "x-" && placement.orientation !== "x+") {
    return getRectBounds(placement.center, placement.width, placement.height)
  }

  const width = Math.max(placement.width, placement.height)
  const height = NET_LABEL_HORIZONTAL_HEIGHT
  const center = getCenterFromAnchor(
    placement.anchorPoint,
    placement.orientation,
    width,
    height,
  )
  return getRectBounds(center, width, height)
}
