import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputPin } from "lib/types/InputProblem"
import { EPS, LABEL_SEARCH_STEP } from "./constants"
import type { Bounds } from "./types"

const LABEL_TRACE_CLEARANCE = 0.1

export const getCrowdedTopVerticalFanoutAnchorX = ({
  label,
  orientation,
  width,
  pinMap,
  chips,
  outputNetLabelPlacements,
  crowdedPortOnlyLabelIndices,
}: {
  label: NetLabelPlacement
  orientation: "y+" | "y-"
  width: number
  pinMap: Record<string, InputPin & { chipId: string }>
  chips: ChipObstacleSpatialIndex["chips"]
  outputNetLabelPlacements: readonly NetLabelPlacement[]
  crowdedPortOnlyLabelIndices: ReadonlySet<number>
}): { chipBounds: Bounds; anchorX: number } | null => {
  const firstPinId = label.pinIds[0]
  const pin = firstPinId ? pinMap[firstPinId] : undefined
  const chip = pin
    ? chips.find((candidate) => candidate.chipId === pin.chipId)
    : undefined
  if (!pin || !chip) return null

  const nextPinToRight = outputNetLabelPlacements
    .flatMap((otherLabel, index) => {
      if (!crowdedPortOnlyLabelIndices.has(index)) return []
      const otherPinId = otherLabel.pinIds[0]
      const otherPin = otherPinId ? pinMap[otherPinId] : undefined
      if (!otherPin || otherPin.chipId !== pin.chipId) return []
      return otherPin.x > pin.x + EPS ? [otherPin] : []
    })
    .sort((a, b) => a.x - b.x)[0]

  if (orientation === "y-" && nextPinToRight) return null

  const anchorX =
    orientation === "y-"
      ? Math.max(
          label.anchorPoint.x + LABEL_SEARCH_STEP,
          chip.bounds.maxX + width / 2 + LABEL_TRACE_CLEARANCE,
        )
      : Math.min(
          label.anchorPoint.x,
          (nextPinToRight?.x ?? chip.bounds.maxX) -
            LABEL_SEARCH_STEP -
            width / 2,
        )

  return { chipBounds: chip.bounds, anchorX }
}
