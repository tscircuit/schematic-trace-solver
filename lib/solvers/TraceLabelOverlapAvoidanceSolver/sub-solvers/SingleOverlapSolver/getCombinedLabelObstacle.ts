import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

/**
 * Builds a temporary obstacle for detour generation without moving any label.
 * Centers and bounds are points in schematic-world millimeters, with +X right
 * and +Y up in the right-handed XY plane. Width and height are axis extents.
 */
export const getCombinedLabelObstacle = (
  targetLabel: NetLabelPlacement,
  blockingLabels: NetLabelPlacement[],
): NetLabelPlacement => {
  const bounds = [targetLabel, ...blockingLabels].map((label) =>
    getRectBounds(label.center, label.width, label.height),
  )
  const minX = Math.min(...bounds.map((labelBounds) => labelBounds.minX))
  const maxX = Math.max(...bounds.map((labelBounds) => labelBounds.maxX))
  const minY = Math.min(...bounds.map((labelBounds) => labelBounds.minY))
  const maxY = Math.max(...bounds.map((labelBounds) => labelBounds.maxY))
  return {
    ...targetLabel,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    width: maxX - minX,
    height: maxY - minY,
  }
}
