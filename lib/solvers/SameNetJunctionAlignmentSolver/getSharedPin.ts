import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin } from "lib/types/InputProblem"

export const getSharedPin = ({
  donorTrace,
  branchTrace,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
}): (InputPin & { chipId: string }) | null => {
  const branchPinIds = new Set(branchTrace.pins.map((pin) => pin.pinId))
  return donorTrace.pins.find((pin) => branchPinIds.has(pin.pinId)) ?? null
}
