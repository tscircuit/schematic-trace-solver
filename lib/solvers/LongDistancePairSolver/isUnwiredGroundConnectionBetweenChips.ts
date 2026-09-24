import type { ConnectivityMap } from "connectivity-map"
import type {
  ChipId,
  InputChip,
  InputNetConnection,
  InputPin,
} from "lib/types/InputProblem"

const SAME_GROUND_ROW_TOLERANCE = 1e-6

export const isUnwiredGroundConnectionBetweenChips = ({
  connection,
  sourcePin,
  targetPin,
  chipMap,
  directConnMap,
}: {
  connection: InputNetConnection
  sourcePin: InputPin & { chipId: ChipId }
  targetPin: InputPin & { chipId: ChipId }
  chipMap: Record<ChipId, InputChip>
  directConnMap: ConnectivityMap
}) =>
  connection.isGround === true &&
  sourcePin.chipId !== targetPin.chipId &&
  // Level ground pins can share a return rail without crossing component rows.
  Math.abs(sourcePin.y - targetPin.y) > SAME_GROUND_ROW_TOLERANCE &&
  // Two-terminal branches retain their existing shared-rail routing.
  chipMap[sourcePin.chipId]!.pins.length > 2 &&
  chipMap[targetPin.chipId]!.pins.length > 2 &&
  !directConnMap.areIdsConnected(sourcePin.pinId, targetPin.pinId)
