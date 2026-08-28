import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export const doTracesConnectToSameChipSide = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
): boolean => {
  if (!firstTrace.pins || !secondTrace.pins) return false
  return firstTrace.pins.some((firstPin) =>
    secondTrace.pins.some(
      (secondPin) =>
        firstPin.chipId === secondPin.chipId &&
        firstPin._facingDirection !== undefined &&
        firstPin._facingDirection === secondPin._facingDirection,
    ),
  )
}
