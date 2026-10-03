import type { Point } from "@tscircuit/math-utils"
import type { TraceRecoveryPin } from "lib/solvers/NetLabelTraceRecovery/getTraceRecoveryConnectivityMaps"
import { dir } from "lib/utils/dir"

/** The straight line or single elbow reached by extending both pins outwards. */
export const getSimpleConnectionPath = (
  first: TraceRecoveryPin,
  second: TraceRecoveryPin,
): Point[] | undefined => {
  const firstDirection = dir(first._facingDirection)
  const secondDirection = dir(second._facingDirection)
  const dx = second.x - first.x
  const dy = second.y - first.y
  const isAligned = firstDirection.x
    ? Math.abs(dy) <= 1e-6
    : Math.abs(dx) <= 1e-6
  if (
    isAligned &&
    firstDirection.x === -secondDirection.x &&
    firstDirection.y === -secondDirection.y &&
    dx * firstDirection.x + dy * firstDirection.y > 1e-6
  ) {
    return [
      { x: first.x, y: first.y },
      { x: second.x, y: second.y },
    ]
  }
  if (
    firstDirection.x * secondDirection.x ||
    firstDirection.y * secondDirection.y
  )
    return undefined
  const elbow = firstDirection.x
    ? { x: second.x, y: first.y }
    : { x: first.x, y: second.y }
  for (const [pin, direction] of [
    [first, firstDirection],
    [second, secondDirection],
  ] as const) {
    if (
      (elbow.x - pin.x) * direction.x + (elbow.y - pin.y) * direction.y <=
      1e-6
    )
      return undefined
  }
  return [{ x: first.x, y: first.y }, elbow, { x: second.x, y: second.y }]
}
