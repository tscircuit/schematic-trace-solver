import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { isXOrientation, rectsOverlap } from "./geometry"

export const overlapsInitialHorizontalTraceLabel = ({
  labelIndex,
  otherLabelIndex,
  netLabelPlacements,
  outputNetLabelPlacements,
  isPortOnlyLabel,
}: {
  labelIndex: number
  otherLabelIndex: number
  netLabelPlacements: readonly NetLabelPlacement[]
  outputNetLabelPlacements: readonly NetLabelPlacement[]
  isPortOnlyLabel: (label: NetLabelPlacement) => boolean
}): boolean => {
  const initialLabel = netLabelPlacements[labelIndex]
  const otherLabel = outputNetLabelPlacements[otherLabelIndex]
  if (
    !initialLabel ||
    !otherLabel ||
    !isPortOnlyLabel(initialLabel) ||
    isPortOnlyLabel(otherLabel) ||
    !isXOrientation(otherLabel.orientation)
  ) {
    return false
  }
  return rectsOverlap(
    getRectBounds(initialLabel.center, initialLabel.width, initialLabel.height),
    getRectBounds(otherLabel.center, otherLabel.width, otherLabel.height),
  )
}
