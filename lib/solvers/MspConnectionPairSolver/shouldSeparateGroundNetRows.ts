import type { InputNetConnection, InputPin } from "lib/types/InputProblem"

const SAME_RAIL_Y_TOLERANCE = 1e-6
const MIN_GROUPED_RAIL_PIN_COUNT = 3

function isGroupedHorizontalRail({
  pin,
  netPins,
}: {
  pin: InputPin & { chipId: string }
  netPins: Array<InputPin & { chipId: string }>
}) {
  const sameRailPins = netPins.filter(
    (otherPin) => Math.abs(otherPin.y - pin.y) <= SAME_RAIL_Y_TOLERANCE,
  )
  const railChipIds = new Set(sameRailPins.map((railPin) => railPin.chipId))
  return railChipIds.size >= MIN_GROUPED_RAIL_PIN_COUNT
}

export function shouldSeparateGroundNetRows({
  netConnection,
  netPins,
  pin1,
  pin2,
}: {
  netConnection?: InputNetConnection
  netPins: Array<InputPin & { chipId: string }>
  pin1: InputPin & { chipId: string }
  pin2: InputPin & { chipId: string }
}) {
  if (!netConnection?.isGround || pin1.chipId === pin2.chipId) return false
  if (Math.abs(pin1.y - pin2.y) <= SAME_RAIL_Y_TOLERANCE) return false

  // Ground labels preserve connectivity while each grouped rail stays local.
  return (
    isGroupedHorizontalRail({ pin: pin1, netPins }) &&
    isGroupedHorizontalRail({ pin: pin2, netPins })
  )
}
