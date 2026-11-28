import type { InputProblem } from "lib/types/InputProblem"
import type { OverlappingSameNetTraceGroup } from "./NetLabelPlacementSolver"

export function getNetLabelHeightForGroup(params: {
  inputProblem: InputProblem
  group: OverlappingSameNetTraceGroup
}): number | null {
  const { inputProblem, group } = params
  if (group.netId) {
    const directHeight = inputProblem.netConnections.find(
      (connection) => connection.netId === group.netId,
    )?.netLabelHeight
    if (directHeight !== undefined) return directHeight
  }

  const pinIds = group.overlappingTraces?.pins.map((pin) => pin.pinId) ?? []
  if (group.portOnlyPinId) {
    pinIds.push(group.portOnlyPinId)
  }

  return (
    inputProblem.netConnections.find((connection) =>
      connection.pinIds.some((pinId) => pinIds.includes(pinId)),
    )?.netLabelHeight ?? null
  )
}
