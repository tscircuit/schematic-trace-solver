import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "./geometry"

const isPortOnlyLabel = (label: NetLabelPlacement) =>
  label.mspConnectionPairIds.length === 0

export const orderRoutedLabelsBeforeOverlappingPortLabels = ({
  labelIndices,
  netLabelPlacements,
}: {
  labelIndices: number[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  const orderedLabelIndices = [...labelIndices]

  for (const routedLabelIndex of labelIndices) {
    const routedLabel = netLabelPlacements[routedLabelIndex]!
    if (isPortOnlyLabel(routedLabel)) continue

    const routedBounds = getRectBounds(
      routedLabel.center,
      routedLabel.width,
      routedLabel.height,
    )
    const blockingPosition = orderedLabelIndices.findIndex((labelIndex) => {
      const portOnlyLabel = netLabelPlacements[labelIndex]!
      if (!isPortOnlyLabel(portOnlyLabel)) return false
      if (portOnlyLabel.globalConnNetId === routedLabel.globalConnNetId) {
        return false
      }
      const portOnlyBounds = getRectBounds(
        portOnlyLabel.center,
        portOnlyLabel.width,
        portOnlyLabel.height,
      )
      return rectsOverlap(routedBounds, portOnlyBounds)
    })
    const routedPosition = orderedLabelIndices.indexOf(routedLabelIndex)
    if (blockingPosition === -1 || blockingPosition > routedPosition) continue

    orderedLabelIndices.splice(routedPosition, 1)
    orderedLabelIndices.splice(blockingPosition, 0, routedLabelIndex)
  }

  return orderedLabelIndices
}
