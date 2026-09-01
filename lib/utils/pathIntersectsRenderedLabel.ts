import {
  doesSegmentIntersectRect,
  getBoundFromCenteredRect,
  type Point,
} from "@tscircuit/math-utils"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

/** Returns whether a path crosses the rendered text bounds of a net label. */
export const pathIntersectsRenderedLabel = (
  path: Point[],
  label: NetLabelPlacement | InlineNetLabelPlacement,
) => {
  let width = label.width
  let height = label.height
  if ("axis" in label && label.axis === "y") {
    width = label.height
    height = label.width
  }
  const bounds = getBoundFromCenteredRect({
    center: label.center,
    width,
    height,
  })
  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
    if (
      doesSegmentIntersectRect(path[pathIndex]!, path[pathIndex + 1]!, bounds)
    ) {
      return true
    }
  }
  return false
}
