import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

const LABEL_INTERIOR_INSET = 1e-6

export const getNetLabelsIntersectingPath = ({
  path,
  netLabelPlacements,
}: {
  path: Point[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  return netLabelPlacements.filter((label) => {
    const bounds = getRectBounds(label.center, label.width, label.height)
    const labelBounds = {
      minX: bounds.minX + LABEL_INTERIOR_INSET,
      minY: bounds.minY + LABEL_INTERIOR_INSET,
      maxX: bounds.maxX - LABEL_INTERIOR_INSET,
      maxY: bounds.maxY - LABEL_INTERIOR_INSET,
    }
    return path
      .slice(0, -1)
      .some((point, pathIndex) =>
        segmentIntersectsRect(point, path[pathIndex + 1], labelBounds),
      )
  })
}

export const pathIntersectsAnyNetLabel = (params: {
  path: Point[]
  netLabelPlacements: NetLabelPlacement[]
}) => getNetLabelsIntersectingPath(params).length > 0
