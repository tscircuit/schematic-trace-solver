import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

// Insetting distinguishes harmless edge contact from entering the label body.
const NET_LABEL_INTERIOR_INSET = 1e-6

export const pathIntersectsAnyNetLabel = ({
  path,
  netLabelPlacements,
}: {
  path: Point[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  for (const label of netLabelPlacements) {
    const labelBounds = getRectBounds(label.center, label.width, label.height)
    for (let index = 0; index < path.length - 1; index++) {
      if (segmentIntersectsRect(path[index], path[index + 1], labelBounds)) {
        return true
      }
    }
  }
  return false
}

export const pathEntersAnyNetLabel = ({
  path,
  netLabelPlacements,
}: {
  path: Point[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  for (const label of netLabelPlacements) {
    const labelBounds = getRectBounds(label.center, label.width, label.height)
    const labelInteriorBounds = {
      minX: labelBounds.minX + NET_LABEL_INTERIOR_INSET,
      minY: labelBounds.minY + NET_LABEL_INTERIOR_INSET,
      maxX: labelBounds.maxX - NET_LABEL_INTERIOR_INSET,
      maxY: labelBounds.maxY - NET_LABEL_INTERIOR_INSET,
    }
    for (let index = 0; index < path.length - 1; index++) {
      if (
        segmentIntersectsRect(path[index], path[index + 1], labelInteriorBounds)
      ) {
        return true
      }
    }
  }
  return false
}
