import type { InputChip, InputPin, InputProblem } from "lib/types/InputProblem"

type PinWithChipId = InputPin & { chipId: string }

export const shouldPreserveLabeledPeripheralTrace = ({
  inputProblem,
  chipMap,
  pins,
}: {
  inputProblem: InputProblem
  chipMap: Record<string, InputChip>
  pins: [PinWithChipId, PinWithChipId]
}): boolean => {
  const [firstPin, secondPin] = pins
  const directConnection = inputProblem.directConnections.find(
    (connection) =>
      connection.pinIds.includes(firstPin.pinId) &&
      connection.pinIds.includes(secondPin.pinId),
  )
  if (directConnection?.netLabelWidth === undefined) return false

  const firstChip = chipMap[firstPin.chipId]
  const secondChip = chipMap[secondPin.chipId]
  if (!firstChip || !secondChip) return false

  const hasSinglePinPeripheral =
    firstChip.pins.length === 1 || secondChip.pins.length === 1
  if (!hasSinglePinPeripheral) return false

  const pinsFaceEachOtherHorizontally =
    (firstPin._facingDirection === "x-" &&
      secondPin._facingDirection === "x+") ||
    (firstPin._facingDirection === "x+" && secondPin._facingDirection === "x-")

  return pinsFaceEachOtherHorizontally
}
