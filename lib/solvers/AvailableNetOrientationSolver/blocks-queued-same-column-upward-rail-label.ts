import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { EPS } from "./constants"
import type { Bounds } from "./types"

export const blocksQueuedSameColumnUpwardRailLabel = ({
  bounds,
  labelIndex,
  currentLabel,
  inputProblem,
  queuedLabelIndices,
  outputNetLabelPlacements,
  pinMap,
}: {
  bounds: Bounds
  labelIndex: number
  currentLabel: NetLabelPlacement
  inputProblem: InputProblem
  queuedLabelIndices: readonly number[]
  outputNetLabelPlacements: readonly NetLabelPlacement[]
  pinMap: Record<string, InputPin & { chipId: string }>
}) => {
  const allTwoPinChipsHaveFacing = inputProblem.chips
    .filter((chip) => chip.pins.length === 2)
    .every((chip) =>
      chip.pins.every((pin) => pin._facingDirection !== undefined),
    )
  if (!allTwoPinChipsHaveFacing) return false

  for (const queuedIndex of queuedLabelIndices) {
    if (queuedIndex === labelIndex) continue
    const pendingOther = outputNetLabelPlacements[queuedIndex]
    if (pendingOther?.pinIds.length !== 1 || !pendingOther.netId) {
      continue
    }
    const [otherPinId] = pendingOther.pinIds
    const otherPin = otherPinId ? pinMap[otherPinId] : undefined
    if (!otherPin) continue

    const sharesChipColumn = currentLabel.pinIds.some((pinId) => {
      const pin = pinMap[pinId]
      return (
        pin !== undefined &&
        pin.chipId === otherPin.chipId &&
        Math.abs(pin.x - otherPin.x) <= EPS
      )
    })
    if (!sharesChipColumn) continue

    const chipHasRoutedTrace = inputProblem.directConnections.some((dc) =>
      dc.pinIds.some((pinId) => pinMap[pinId]?.chipId === otherPin.chipId),
    )
    if (!chipHasRoutedTrace) continue

    const allowedOrientations =
      inputProblem.availableNetLabelOrientations[pendingOther.netId]
    if (
      allowedOrientations?.length === 1 &&
      allowedOrientations[0] === "y+" &&
      pendingOther.anchorPoint.y >= bounds.minY - EPS &&
      pendingOther.anchorPoint.y <= bounds.maxY + EPS
    ) {
      return true
    }
  }

  return false
}
