import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getCenterFromAnchor } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

export function normalizePortOnlyNetLabelCenter(
  placement: NetLabelPlacement,
): NetLabelPlacement {
  if (placement.pinIds.length !== 1) return placement
  if (placement.mspConnectionPairIds.length !== 0) return placement

  return {
    ...placement,
    center: getCenterFromAnchor(
      placement.anchorPoint,
      placement.orientation,
      placement.width,
      placement.height,
    ),
  }
}
