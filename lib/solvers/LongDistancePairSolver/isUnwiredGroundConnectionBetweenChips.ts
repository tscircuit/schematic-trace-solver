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
}) => {
  const sourceChip = chipMap[sourcePin.chipId]!
  const targetChip = chipMap[targetPin.chipId]!
  return (
    connection.isGround === true &&
    sourcePin.chipId !== targetPin.chipId &&
    // Side-by-side components can share a return even when their pins are staggered.
    Math.abs(sourceChip.center.y - targetChip.center.y) >
      (sourceChip.height + targetChip.height) / 2 + SAME_GROUND_ROW_TOLERANCE &&
    // Two-terminal branches retain their existing shared-rail routing.
    sourceChip.pins.length > 2 &&
    targetChip.pins.length > 2 &&
    !directConnMap.areIdsConnected(sourcePin.pinId, targetPin.pinId)
  )
}
