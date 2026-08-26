import type { InputPin, InputProblem } from "lib/types/InputProblem"

const SAME_RAIL_Y_TOLERANCE = 1e-6
const MIN_GROUPED_RAIL_PIN_COUNT = 3

const isGroupedHorizontalRail = ({
  pin,
  netPins,
}: {
  pin: InputPin & { chipId: string }
  netPins: Array<InputPin & { chipId: string }>
}) => {
  const sameRailPins = netPins.filter(
    (otherPin) => Math.abs(otherPin.y - pin.y) <= SAME_RAIL_Y_TOLERANCE,
  )
  const railChipIds = new Set(sameRailPins.map((railPin) => railPin.chipId))
  return railChipIds.size >= MIN_GROUPED_RAIL_PIN_COUNT
}

export const shouldSeparateDownwardNetLabelRails = ({
  inputProblem,
  userNetId,
  netPins,
  pin1,
  pin2,
}: {
  inputProblem: InputProblem
  userNetId?: string
  netPins: Array<InputPin & { chipId: string }>
  pin1: InputPin & { chipId: string }
  pin2: InputPin & { chipId: string }
}) => {
  if (!userNetId || pin1.chipId === pin2.chipId) return false

  const orientations = inputProblem.availableNetLabelOrientations[userNetId]
  const isDownwardOnly = orientations?.length === 1 && orientations[0] === "y-"
  if (!isDownwardOnly) return false

  if (Math.abs(pin1.y - pin2.y) <= SAME_RAIL_Y_TOLERANCE) return false

  return (
    isGroupedHorizontalRail({ pin: pin1, netPins }) &&
    isGroupedHorizontalRail({ pin: pin2, netPins })
  )
}
