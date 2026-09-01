import type { InputNetConnection, InputPin } from "lib/types/InputProblem"
import { MAX_LOCAL_GROUND_BRANCH_OFFSET } from "./getGroundConnectionPolicy"

const SAME_RAIL_Y_TOLERANCE = 1e-6
const MIN_GROUPED_RAIL_CHIP_COUNT = 2

function getHorizontalRailChipCount({
  pin,
  netPins,
}: {
  pin: InputPin & { chipId: string }
  netPins: Array<InputPin & { chipId: string }>
}) {
  // Multiple pins from one symbol do not establish a grouped component rail.
  const sameRailPins = netPins.filter(
    (otherPin) => Math.abs(otherPin.y - pin.y) <= SAME_RAIL_Y_TOLERANCE,
  )
  const railChipIds = new Set(sameRailPins.map((railPin) => railPin.chipId))
  return railChipIds.size
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
  if (
    Math.abs(pin1.y - pin2.y) <=
    MAX_LOCAL_GROUND_BRANCH_OFFSET + SAME_RAIL_Y_TOLERANCE
  ) {
    return false
  }

  const pin1RailChipCount = getHorizontalRailChipCount({ pin: pin1, netPins })
  const pin2RailChipCount = getHorizontalRailChipCount({ pin: pin2, netPins })
  // Net labels preserve ground connectivity without a cross-row MSP edge.
  return (
    pin1RailChipCount >= MIN_GROUPED_RAIL_CHIP_COUNT &&
    pin2RailChipCount >= MIN_GROUPED_RAIL_CHIP_COUNT
  )
}
