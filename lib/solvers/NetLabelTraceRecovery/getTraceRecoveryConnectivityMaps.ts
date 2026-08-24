import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type {
  ChipId,
  InputChip,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

export type TraceRecoveryPin = MspConnectionPair["pins"][number] & {
  _facingDirection: FacingDirection
}

export const getTraceRecoveryConnectivityMaps = (
  inputProblem: InputProblem,
) => {
  const chipMap: Record<ChipId, InputChip> = {}
  const pinMap = new Map<PinId, TraceRecoveryPin>()

  for (const chip of inputProblem.chips) {
    chipMap[chip.chipId] = chip
    for (const pin of chip.pins) {
      pinMap.set(pin.pinId, {
        ...pin,
        chipId: chip.chipId,
        _facingDirection: pin._facingDirection ?? getPinDirection(pin, chip),
      })
    }
  }

  return { chipMap, pinMap }
}
