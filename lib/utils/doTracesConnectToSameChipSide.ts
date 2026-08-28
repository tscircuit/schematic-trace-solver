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

export const doTracesConnectToExactlyOneSharedChipSide = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
): boolean => {
  if (!firstTrace.pins || !secondTrace.pins) return false

  const firstTraceChipSides = new Set(
    firstTrace.pins
      .filter((pin) => pin._facingDirection !== undefined)
      .map((pin) => `${pin.chipId}:${pin._facingDirection}`),
  )
  const sharedChipSides = new Set(
    secondTrace.pins
      .filter((pin) => pin._facingDirection !== undefined)
      .map((pin) => `${pin.chipId}:${pin._facingDirection}`)
      .filter((chipSide) => firstTraceChipSides.has(chipSide)),
  )

  return sharedChipSides.size === 1
}
