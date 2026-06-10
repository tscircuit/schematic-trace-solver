import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import type { CandidateLabel } from "./types"

export const getPinMap = (inputProblem: InputProblem) => {
  const pinMap: Record<string, InputPin & { chipId: string }> = {}
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      pinMap[pin.pinId] = { ...pin, chipId: chip.chipId }
    }
  }
  return pinMap
}

export const getTracePins = (
  label: NetLabelPlacement,
  pinMap: Record<string, InputPin & { chipId: string }>,
): SolvedTracePath["pins"] => {
  const pins = label.pinIds.flatMap((pinId) => {
    const pin = pinMap[pinId]
    return pin ? [pin] : []
  })

  if (pins.length >= 2) return [pins[0]!, pins[1]!]
  if (pins.length === 1) return [pins[0]!, pins[0]!]

  const syntheticPin = {
    pinId: `${label.globalConnNetId}-netlabel-anchor`,
    x: label.anchorPoint.x,
    y: label.anchorPoint.y,
    chipId: "available-net-orientation",
  }
  return [syntheticPin, syntheticPin]
}

export const toNetLabelPlacementPatch = (candidate: CandidateLabel) => ({
  orientation: candidate.orientation,
  anchorPoint: candidate.anchorPoint,
  center: candidate.center,
  width: candidate.width,
  height: candidate.height,
})
