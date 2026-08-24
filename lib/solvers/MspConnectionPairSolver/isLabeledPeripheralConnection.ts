import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"
import { NET_LABEL_HORIZONTAL_HEIGHT } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"

type PinWithChipId = InputPin & { chipId: string }

export type LabeledConnectionRouteReason =
  | "single-pin-peripheral"
  | "overlapping-fallback-labels"

export const getLabeledConnectionRouteReason = ({
  inputProblem,
  chipMap,
  pins,
}: {
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>
  pins: [PinWithChipId, PinWithChipId]
}): LabeledConnectionRouteReason | null => {
  const [firstPin, secondPin] = pins
  const directConnection = inputProblem.directConnections.find(
    (connection) =>
      connection.pinIds.includes(firstPin.pinId) &&
      connection.pinIds.includes(secondPin.pinId),
  )
  if (directConnection?.netLabelWidth === undefined) return null

  const firstChip = chipMap[firstPin.chipId]
  const secondChip = chipMap[secondPin.chipId]
  if (!firstChip || !secondChip) return null

  let firstFacingDirection = firstPin._facingDirection
  if (!firstFacingDirection) {
    firstFacingDirection = getPinDirection(firstPin, firstChip)
  }
  let secondFacingDirection = secondPin._facingDirection
  if (!secondFacingDirection) {
    secondFacingDirection = getPinDirection(secondPin, secondChip)
  }

  const hasOpposingHorizontalDirections =
    (firstFacingDirection === "x-" && secondFacingDirection === "x+") ||
    (firstFacingDirection === "x+" && secondFacingDirection === "x-")
  if (!hasOpposingHorizontalDirections) return null

  const hasSinglePinPeripheral =
    firstChip.pins.length === 1 || secondChip.pins.length === 1
  if (hasSinglePinPeripheral) return "single-pin-peripheral"

  // The overlap fallback is intended for explicitly grouped schematic
  // sections, where hierarchy boxes and their nearby connectors are laid out
  // as one visual unit. Applying it to ordinary sheets can reroute unrelated
  // component-to-component labels elsewhere in the design.
  const sharedSectionId =
    firstChip.sectionId && firstChip.sectionId === secondChip.sectionId
      ? firstChip.sectionId
      : null
  if (!sharedSectionId) return null

  // When two multi-pin components face each other across a short gap, the
  // fallback label at each pin can be wider than the available space. Route
  // the explicit connection instead of rendering two copies of the long net
  // name on top of one another.
  const firstIsLeft = firstPin.x <= secondPin.x
  const directionsPointTowardEachOther = firstIsLeft
    ? firstFacingDirection === "x+" && secondFacingDirection === "x-"
    : firstFacingDirection === "x-" && secondFacingDirection === "x+"
  const labelsOverlapAlongX =
    Math.abs(firstPin.x - secondPin.x) < directConnection.netLabelWidth * 2
  const labelsOverlapAlongY =
    Math.abs(firstPin.y - secondPin.y) < NET_LABEL_HORIZONTAL_HEIGHT

  const fallbackLabelsOverlap =
    directionsPointTowardEachOther && labelsOverlapAlongX && labelsOverlapAlongY
  return fallbackLabelsOverlap ? "overlapping-fallback-labels" : null
}

export const isLabeledPeripheralConnection = (
  params: Parameters<typeof getLabeledConnectionRouteReason>[0],
) => getLabeledConnectionRouteReason(params) !== null
