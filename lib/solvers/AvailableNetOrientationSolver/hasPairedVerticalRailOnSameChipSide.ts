import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type {
  ChipId,
  InputNetConnection,
  InputPin,
  InputProblem,
} from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { EPS } from "./constants"
import { isYOrientation } from "./geometry"
import type { Bounds } from "./types"

/**
 * Checks whether a single-chip-side vertical rail shares that chip side with
 * an opposite vertical rail, or with another upward vertical power rail when
 * no other connected pin on that side sits inside the rail's vertical span.
 */
export const hasPairedVerticalRailOnSameChipSide = ({
  label,
  orientation,
  inputProblem,
  pinMap,
  chips,
}: {
  label: NetLabelPlacement
  orientation: "y+" | "y-"
  inputProblem: InputProblem
  pinMap: Record<string, InputPin & { chipId: string }>
  chips: readonly { chipId: ChipId; bounds: Bounds }[]
}): boolean => {
  const currentConnection = inputProblem.netConnections.find(
    (connection) => connection.netId === label.netId,
  )
  if (!currentConnection || currentConnection.pinIds.length < 2) return false

  let currentChipId: string | null = null
  for (const pinId of currentConnection.pinIds) {
    const pin = pinMap[pinId]
    if (!pin) return false
    if (currentChipId !== null && pin.chipId !== currentChipId) return false
    currentChipId = pin.chipId
  }
  if (!currentChipId) return false
  const currentChip = chips.find(
    (candidate) => candidate.chipId === currentChipId,
  )
  if (!currentChip) return false

  let currentSide: "left" | "right" | null = null
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const pinId of currentConnection.pinIds) {
    const pin = pinMap[pinId]
    if (!pin) return false
    const side =
      Math.abs(pin.x - currentChip.bounds.minX) <= EPS
        ? "left"
        : Math.abs(pin.x - currentChip.bounds.maxX) <= EPS
          ? "right"
          : null
    if (!side || (currentSide !== null && side !== currentSide)) return false
    currentSide = side
    minY = Math.min(minY, pin.y)
    maxY = Math.max(maxY, pin.y)
  }
  if (!currentSide) return false

  const currentPinIdSet = new Set(currentConnection.pinIds)
  const spansOtherConnectedPinOnSide = inputProblem.netConnections.some(
    (connection) =>
      connection !== currentConnection &&
      connection.pinIds.some((pinId) => {
        if (currentPinIdSet.has(pinId)) return false
        const pin = pinMap[pinId]
        if (!pin || pin.chipId !== currentChipId) return false
        const onSameSide =
          currentSide === "left"
            ? Math.abs(pin.x - currentChip.bounds.minX) <= EPS
            : Math.abs(pin.x - currentChip.bounds.maxX) <= EPS
        return onSameSide && pin.y > minY + EPS && pin.y < maxY - EPS
      }),
  )

  const oppositeOrientation = orientation === "y+" ? "y-" : "y+"
  return inputProblem.netConnections.some((connection: InputNetConnection) => {
    if (connection === currentConnection || connection.pinIds.length < 2) {
      return false
    }
    const availableOrientations: FacingDirection[] =
      inputProblem.availableNetLabelOrientations[connection.netId] ?? []
    const peerOrientation = availableOrientations[0]
    if (availableOrientations.length !== 1 || !peerOrientation) return false
    const isOppositePeer = peerOrientation === oppositeOrientation
    const isSameSidePowerPeer =
      orientation === "y+" &&
      peerOrientation === "y+" &&
      !spansOtherConnectedPinOnSide &&
      isYOrientation(peerOrientation)
    if (!isOppositePeer && !isSameSidePowerPeer) return false

    for (const pinId of connection.pinIds) {
      const pin = pinMap[pinId]
      if (!pin || pin.chipId !== currentChipId) return false
      const side =
        Math.abs(pin.x - currentChip.bounds.minX) <= EPS
          ? "left"
          : Math.abs(pin.x - currentChip.bounds.maxX) <= EPS
            ? "right"
            : null
      if (side !== currentSide) return false
    }
    return true
  })
}
