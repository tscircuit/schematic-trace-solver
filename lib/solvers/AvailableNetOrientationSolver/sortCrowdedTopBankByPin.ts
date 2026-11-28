import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { ChipId, InputPin } from "lib/types/InputProblem"
import type { ChipSide } from "./types"

export function sortCrowdedTopBankByPin(params: {
  indices: number[]
  crowdedPortOnlyLabelIndices: ReadonlySet<number>
  outputNetLabelPlacements: NetLabelPlacement[]
  pinMap: Record<string, InputPin & { chipId: string }>
  getChipSideForPoint: (point: { x: number; y: number }) => ChipSide | null
}): void {
  const {
    indices,
    crowdedPortOnlyLabelIndices,
    outputNetLabelPlacements,
    pinMap,
    getChipSideForPoint,
  } = params
  const slotsByChip = new Map<ChipId, number[]>()

  for (let slot = 0; slot < indices.length; slot++) {
    const labelIndex = indices[slot]!
    if (!crowdedPortOnlyLabelIndices.has(labelIndex)) continue
    const label = outputNetLabelPlacements[labelIndex]!
    if (getChipSideForPoint(label.anchorPoint) !== "top") continue
    const pin = pinMap[label.pinIds[0]!]
    if (!pin) continue
    const slots = slotsByChip.get(pin.chipId) ?? []
    slots.push(slot)
    slotsByChip.set(pin.chipId, slots)
  }

  for (const slots of slotsByChip.values()) {
    const labelIndices = slots
      .map((slot) => indices[slot]!)
      .sort((first, second) => {
        const firstPin = pinMap[outputNetLabelPlacements[first]!.pinIds[0]!]
        const secondPin = pinMap[outputNetLabelPlacements[second]!.pinIds[0]!]
        return firstPin!.x - secondPin!.x
      })
    for (let position = 0; position < slots.length; position++) {
      indices[slots[position]!] = labelIndices[position]!
    }
  }
}
