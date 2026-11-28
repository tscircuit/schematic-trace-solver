import type { Point } from "@tscircuit/math-utils"
import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { EPS } from "./constants"
import { rectsOverlap } from "./geometry"

export const shouldTryDoglegPortOnlyShift = ({
  label,
  labelIndex,
  initialBaseAnchor,
  chipObstacleSpatialIndex,
  outputNetLabelPlacements,
}: {
  label: NetLabelPlacement
  labelIndex: number
  initialBaseAnchor: Point
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  outputNetLabelPlacements: readonly NetLabelPlacement[]
}): boolean => {
  const startAnchorInsideChip =
    chipObstacleSpatialIndex.getChipsInBounds({
      minX: initialBaseAnchor.x - EPS,
      minY: initialBaseAnchor.y - EPS,
      maxX: initialBaseAnchor.x + EPS,
      maxY: initialBaseAnchor.y + EPS,
    }).length > 0
  if (startAnchorInsideChip) return true

  const currentBounds = getRectBounds(label.center, label.width, label.height)
  return outputNetLabelPlacements.some(
    (otherLabel, otherIndex) =>
      otherIndex !== labelIndex &&
      otherLabel.globalConnNetId === label.globalConnNetId &&
      rectsOverlap(
        currentBounds,
        getRectBounds(otherLabel.center, otherLabel.width, otherLabel.height),
      ),
  )
}
