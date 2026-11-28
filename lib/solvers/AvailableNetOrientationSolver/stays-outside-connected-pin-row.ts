import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputPin } from "lib/types/InputProblem"
import { EPS } from "./constants"
import { isYOrientation } from "./geometry"
import type { Bounds, CandidateLabel } from "./types"

const CONNECTED_PIN_ROW_OVERLAP_TOLERANCE = 0.1

export const staysOutsideConnectedPinRow = ({
  candidate,
  label,
  bounds,
  pinMap,
  chipObstacleSpatialIndex,
}: {
  candidate: CandidateLabel
  label: NetLabelPlacement
  bounds: Bounds
  pinMap: Record<string, InputPin & { chipId: string }>
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
}) => {
  const [firstPinId] = label.pinIds
  const pin = firstPinId ? pinMap[firstPinId] : undefined
  if (!pin || !isYOrientation(candidate.orientation)) return false

  const chip = chipObstacleSpatialIndex.chips.find(
    (candidateChip) => candidateChip.chipId === pin.chipId,
  )
  const sourceWithinChipVerticalSpan =
    chip !== undefined &&
    candidate.connectorSource !== undefined &&
    (candidate.orientation === "y-"
      ? candidate.connectorSource.y - candidate.height > chip.bounds.minY + EPS
      : candidate.connectorSource.y + candidate.height < chip.bounds.maxY - EPS)
  const overlapsChipVerticalSpan =
    sourceWithinChipVerticalSpan &&
    chip !== undefined &&
    bounds.maxY > chip.bounds.minY + EPS &&
    bounds.minY < chip.bounds.maxY - EPS
  const tolerance = overlapsChipVerticalSpan
    ? 0
    : CONNECTED_PIN_ROW_OVERLAP_TOLERANCE

  if (candidate.anchorPoint.x < pin.x) {
    return bounds.maxX <= pin.x + tolerance + EPS
  }
  return bounds.minX >= pin.x - tolerance - EPS
}
