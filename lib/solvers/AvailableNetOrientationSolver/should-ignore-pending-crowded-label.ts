import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

export const shouldIgnorePendingCrowdedLabel = ({
  labelIndex,
  otherLabelIndex,
  queuedLabelIndices,
  crowdedPortOnlyLabelIndices,
  netLabelPlacements,
  isPortOnlyLabel,
}: {
  labelIndex: number
  otherLabelIndex: number
  queuedLabelIndices: readonly number[]
  crowdedPortOnlyLabelIndices: ReadonlySet<number>
  netLabelPlacements: readonly NetLabelPlacement[]
  isPortOnlyLabel: (label: NetLabelPlacement) => boolean
}): boolean => {
  if (!queuedLabelIndices.includes(otherLabelIndex)) return false
  if (
    crowdedPortOnlyLabelIndices.has(labelIndex) &&
    crowdedPortOnlyLabelIndices.has(otherLabelIndex)
  ) {
    return true
  }
  const label = netLabelPlacements[labelIndex]
  const otherLabel = netLabelPlacements[otherLabelIndex]
  return Boolean(
    label &&
      otherLabel &&
      isPortOnlyLabel(label) &&
      isPortOnlyLabel(otherLabel) &&
      Math.hypot(
        label.anchorPoint.x - otherLabel.anchorPoint.x,
        label.anchorPoint.y - otherLabel.anchorPoint.y,
      ) <= 1e-4,
  )
}
