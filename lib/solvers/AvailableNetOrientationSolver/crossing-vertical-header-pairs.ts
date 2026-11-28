import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { EPS } from "./constants"
import type { CrossingVerticalHeaderPair } from "./types"

const MAX_CROSSING_HEADER_PIN_SPAN = 0.35
const MAX_SINGLE_COLUMN_HEADER_PINS = 12

export const orderCrossingVerticalHeaderPairs = ({
  orderedIndices,
  netLabelPlacements,
  pinMap,
  inputProblem,
  getAvailableOrientations,
}: {
  orderedIndices: number[]
  netLabelPlacements: NetLabelPlacement[]
  pinMap: Record<string, InputPin & { chipId: string }>
  inputProblem: InputProblem
  getAvailableOrientations: (label: NetLabelPlacement) => FacingDirection[]
}): CrossingVerticalHeaderPair[] => {
  const pairs: CrossingVerticalHeaderPair[] = []

  for (let i = 0; i < orderedIndices.length; i++) {
    for (let j = 0; j < orderedIndices.length; j++) {
      if (i === j) continue
      const upperIdx = orderedIndices[i]
      const lowerIdx = orderedIndices[j]
      if (upperIdx === undefined || lowerIdx === undefined) continue
      const upper = netLabelPlacements[upperIdx]
      const lower = netLabelPlacements[lowerIdx]
      if (!upper || !lower) continue
      if (
        upper.mspConnectionPairIds.length > 0 ||
        lower.mspConnectionPairIds.length > 0
      ) {
        continue
      }

      const [upperPinId] = upper.pinIds
      const [lowerPinId] = lower.pinIds
      const uPin = upperPinId ? pinMap[upperPinId] : undefined
      const lPin = lowerPinId ? pinMap[lowerPinId] : undefined
      if (!uPin || !lPin || uPin.chipId !== lPin.chipId) continue
      if (Math.abs(uPin.x - lPin.x) > EPS) continue
      if (
        uPin.y <= lPin.y + EPS ||
        uPin.y - lPin.y > MAX_CROSSING_HEADER_PIN_SPAN
      ) {
        continue
      }

      const chip = inputProblem.chips.find(
        (candidate) => candidate.chipId === uPin.chipId,
      )
      if (!chip || chip.height <= chip.width) continue
      const sidePins = chip.pins.filter(
        (pin) => Math.abs(pin.x - uPin.x) <= EPS,
      )
      if (
        sidePins.length !== chip.pins.length ||
        sidePins.length > MAX_SINGLE_COLUMN_HEADER_PINS
      ) {
        continue
      }

      const uAvail = getAvailableOrientations(upper)
      const lAvail = getAvailableOrientations(lower)
      if (
        uAvail.length === 1 &&
        uAvail[0] === "y-" &&
        lAvail.length === 1 &&
        lAvail[0] === "y+"
      ) {
        pairs.push({
          lowerIdx,
          upperIdx,
          upperY: uPin.y,
        })
      }
    }
  }

  for (const pair of pairs) {
    const posUpper = orderedIndices.indexOf(pair.upperIdx)
    const posLower = orderedIndices.indexOf(pair.lowerIdx)
    if (posUpper >= 0 && posLower > posUpper) {
      orderedIndices[posUpper] = pair.lowerIdx
      orderedIndices[posLower] = pair.upperIdx
    }
  }

  return pairs
}
