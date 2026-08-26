import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { SpatiallyIndexedChip } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { InputPin } from "lib/types/InputProblem"
import { EPS } from "./constants"
import type { CandidateLabel } from "./types"

export const isVerticalRailAnchorCandidateClearAlongChipSide = (params: {
  candidate: CandidateLabel
  label: NetLabelPlacement
  traces: SolvedTracePath[]
  pinMap: Record<string, InputPin & { chipId: string }>
  chips: SpatiallyIndexedChip[]
}) => {
  const { candidate, label, traces, pinMap, chips } = params
  if (candidate.orientation !== "y+" && candidate.orientation !== "y-") {
    return false
  }

  const isOnDirectHostTrace = label.mspConnectionPairIds.some((traceId) => {
    const trace = traces.find(
      (candidateTrace) => candidateTrace.mspPairId === traceId,
    )
    return (
      trace && tracePathContainsPoint(trace.tracePath, candidate.anchorPoint)
    )
  })
  if (!isOnDirectHostTrace) return false

  const labelPins = label.pinIds.flatMap((pinId) => {
    const pin = pinMap[pinId]
    return pin ? [pin] : []
  })
  const labelPinChipIds = new Set(labelPins.map((pin) => pin.chipId))
  if (labelPinChipIds.size !== 1) return false

  const labelPinChipId = labelPins[0]?.chipId
  const chip = chips.find(
    (candidateChip) => candidateChip.chipId === labelPinChipId,
  )
  if (!chip) return false

  const bounds = getRectBounds(
    candidate.center,
    candidate.width,
    candidate.height,
  )
  if (
    bounds.minY < chip.bounds.minY - EPS ||
    bounds.maxY > chip.bounds.maxY + EPS
  ) {
    return false
  }

  const isOutsideChipSide =
    candidate.anchorPoint.x < chip.bounds.minX - EPS ||
    candidate.anchorPoint.x > chip.bounds.maxX + EPS
  if (!isOutsideChipSide) return false

  const labelPinIds = new Set(label.pinIds)
  return chip.pins.every((pin) => {
    if (labelPinIds.has(pin.pinId)) return true
    return pin.y <= bounds.minY + EPS || pin.y >= bounds.maxY - EPS
  })
}
