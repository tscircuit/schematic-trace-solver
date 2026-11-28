import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin } from "lib/types/InputProblem"
import { EPS } from "./constants"
import type { CandidateLabel } from "./types"

export const canPlaceVerticalLabelOnHostRail = ({
  candidate,
  label,
  railTraceIds,
  traceMap,
  pinMap,
  chipObstacleSpatialIndex,
}: {
  candidate: CandidateLabel
  label: NetLabelPlacement
  railTraceIds: ReadonlySet<MspConnectionPairId>
  traceMap: Record<string, SolvedTracePath>
  pinMap: Record<string, InputPin & { chipId: string }>
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
}) => {
  const isOnHostRail = [...railTraceIds].some((traceId) => {
    const trace = traceMap[traceId]
    return Boolean(
      trace && tracePathContainsPoint(trace.tracePath, candidate.anchorPoint),
    )
  })
  if (!isOnHostRail) return false

  const [firstPinId] = label.pinIds
  const hostPin = firstPinId ? pinMap[firstPinId] : undefined
  if (!hostPin) return false
  if (label.pinIds.some((pinId) => pinMap[pinId]?.chipId !== hostPin.chipId)) {
    return false
  }

  const chip = chipObstacleSpatialIndex.chips.find(
    (candidateChip) => candidateChip.chipId === hostPin.chipId,
  )
  if (!chip) return false

  const labelBounds = getRectBounds(
    candidate.center,
    candidate.width,
    candidate.height,
  )
  if (
    labelBounds.minY < chip.bounds.minY - EPS ||
    labelBounds.maxY > chip.bounds.maxY + EPS
  ) {
    return false
  }

  if (
    candidate.anchorPoint.x >= chip.bounds.minX - EPS &&
    candidate.anchorPoint.x <= chip.bounds.maxX + EPS
  ) {
    return false
  }

  return chip.pins.every(
    (pin) =>
      Math.abs(pin.x - hostPin.x) > EPS ||
      label.pinIds.includes(pin.pinId) ||
      pin.y <= labelBounds.minY + EPS ||
      pin.y >= labelBounds.maxY - EPS,
  )
}
