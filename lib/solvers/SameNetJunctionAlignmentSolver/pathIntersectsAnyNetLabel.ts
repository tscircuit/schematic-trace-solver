import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

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
