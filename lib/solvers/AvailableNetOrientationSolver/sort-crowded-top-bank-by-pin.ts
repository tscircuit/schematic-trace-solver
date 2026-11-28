import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { ChipId, InputPin } from "lib/types/InputProblem"
import type { ChipSide } from "./types"

export const sortCrowdedTopBankByPin = ({
  indices,
  crowdedPortOnlyLabelIndices,
  netLabelPlacements,
  pinMap,
  getChipSideForPoint,
}: {
  indices: number[]
  crowdedPortOnlyLabelIndices: ReadonlySet<number>
  netLabelPlacements: NetLabelPlacement[]
  pinMap: Record<string, InputPin & { chipId: string }>
  getChipSideForPoint: (point: Point) => ChipSide | null
}) => {
  const slotsByChip = new Map<ChipId, number[]>()

  for (let slot = 0; slot < indices.length; slot++) {
    const labelIndex = indices[slot]
    if (labelIndex === undefined) continue
    if (!crowdedPortOnlyLabelIndices.has(labelIndex)) continue
    const label = netLabelPlacements[labelIndex]
    if (!label || getChipSideForPoint(label.anchorPoint) !== "top") continue
    const [firstPinId] = label.pinIds
    const pin = firstPinId ? pinMap[firstPinId] : undefined
    if (!pin) continue
    const slots = slotsByChip.get(pin.chipId) ?? []
    slots.push(slot)
    slotsByChip.set(pin.chipId, slots)
  }

  for (const slots of slotsByChip.values()) {
    const labelIndices: number[] = []
    for (const slot of slots) {
      const idx = indices[slot]
      if (idx !== undefined) labelIndices.push(idx)
    }
    labelIndices.sort((a, b) => {
      const aPinId = netLabelPlacements[a]?.pinIds[0]
      const bPinId = netLabelPlacements[b]?.pinIds[0]
      const aX = (aPinId ? pinMap[aPinId]?.x : undefined) ?? 0
      const bX = (bPinId ? pinMap[bPinId]?.x : undefined) ?? 0
      return aX - bX
    })
    for (let position = 0; position < slots.length; position++) {
      const slot = slots[position]
      const idx = labelIndices[position]
      if (slot !== undefined && idx !== undefined) {
        indices[slot] = idx
      }
    }
  }
}
