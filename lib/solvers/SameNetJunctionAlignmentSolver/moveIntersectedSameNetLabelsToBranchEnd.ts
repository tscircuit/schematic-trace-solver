import { getCenterFromAnchor } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin } from "lib/types/InputProblem"
import { getNetLabelsIntersectingPath } from "./pathIntersectsAnyNetLabel"

export const moveIntersectedSameNetLabelsToBranchEnd = ({
  candidateTrace,
  branchEndPin,
  netLabelPlacements,
}: {
  candidateTrace: SolvedTracePath
  branchEndPin: InputPin
  netLabelPlacements: NetLabelPlacement[]
}): NetLabelPlacement[] | null => {
  const intersectedLabels = getNetLabelsIntersectingPath({
    path: candidateTrace.tracePath,
    netLabelPlacements,
  })
  if (
    intersectedLabels.some(
      (label) => label.globalConnNetId !== candidateTrace.globalConnNetId,
    )
  ) {
    return null
  }

  const intersectedLabelSet = new Set(intersectedLabels)
  const movedLabels = netLabelPlacements.map((label) => {
    if (!intersectedLabelSet.has(label)) return label
    const anchorPoint = { x: branchEndPin.x, y: branchEndPin.y }
    return {
      ...label,
      anchorPoint,
      center: getCenterFromAnchor(
        anchorPoint,
        label.orientation,
        label.width,
        label.height,
      ),
      mspConnectionPairIds: [candidateTrace.mspPairId],
      pinIds: candidateTrace.pins.map((pin) => pin.pinId),
    }
  })

  const remainingIntersections = getNetLabelsIntersectingPath({
    path: candidateTrace.tracePath,
    netLabelPlacements: movedLabels,
  })
  if (remainingIntersections.length > 0) return null
  return movedLabels
}
