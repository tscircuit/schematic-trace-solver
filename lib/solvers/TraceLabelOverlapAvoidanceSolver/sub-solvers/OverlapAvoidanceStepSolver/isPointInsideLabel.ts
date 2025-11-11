import type { Point } from "graphics-debug"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

/**
 * Checks if a point is inside the bounding box of a net label.
 */
export const isPointInsideLabel = ({
  point,
  label,
}: {
  point: Point
  label: NetLabelPlacement
}): boolean => {
  const bounds = getRectBounds(label.center, label.width, label.height)

  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  )
}
