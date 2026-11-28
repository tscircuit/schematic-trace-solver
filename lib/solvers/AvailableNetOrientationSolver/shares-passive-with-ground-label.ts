import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"

export const sharesPassiveWithGroundLabel = ({
  label,
  labelIndex,
  inputProblem,
  outputNetLabelPlacements,
  pinMap,
  isGroundLabel,
}: {
  label: NetLabelPlacement
  labelIndex: number
  inputProblem: InputProblem
  outputNetLabelPlacements: NetLabelPlacement[]
  pinMap: Record<string, InputPin & { chipId: string }>
  isGroundLabel: (candidate: NetLabelPlacement) => boolean
}) => {
  if (inputProblem.directConnections.length > 0 || label.pinIds.length !== 1) {
    return false
  }
  const [firstPinId] = label.pinIds
  const labelChipId = firstPinId ? pinMap[firstPinId]?.chipId : undefined
  if (!labelChipId) return false

  return outputNetLabelPlacements.some(
    (other, index) =>
      index !== labelIndex &&
      isGroundLabel(other) &&
      other.pinIds.some((pinId) => pinMap[pinId]?.chipId === labelChipId),
  )
}
