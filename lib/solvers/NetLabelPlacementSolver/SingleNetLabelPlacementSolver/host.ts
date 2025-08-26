import type { InputChip, InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

export function lengthOfTrace(path: SolvedTracePath): number {
  let sum = 0
  const pts = path.tracePath
  for (let i = 0; i < pts.length - 1; i++) {
    sum +=
      Math.abs(pts[i + 1]!.x - pts[i]!.x) + Math.abs(pts[i + 1]!.y - pts[i]!.y)
  }
  return sum
}

export function chooseHostTraceForGroup(params: {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  globalConnNetId: string
  fallbackTrace?: SolvedTracePath
}): SolvedTracePath | undefined {
  const { inputProblem, inputTraceMap, globalConnNetId, fallbackTrace } = params

  const chipsById: Record<string, InputChip> = Object.fromEntries(
    inputProblem.chips.map((c) => [c.chipId, c]),
  )

  const groupTraces = Object.values(inputTraceMap).filter(
    (t) => t.globalConnNetId === globalConnNetId,
  )

  const chipIdsInGroup = new Set<string>()
  for (const t of groupTraces) {
    chipIdsInGroup.add(t.pins[0].chipId)
    chipIdsInGroup.add(t.pins[1].chipId)
  }

  let largestChipId: string | null = null
  let largestPinCount = -1
  for (const id of chipIdsInGroup) {
    const chip = chipsById[id]
    const count = chip?.pins?.length ?? 0
    if (count > largestPinCount) {
      largestPinCount = count
      largestChipId = id
    }
  }

  const hostCandidates =
    largestChipId == null
      ? []
      : groupTraces.filter(
          (t) =>
            t.pins[0].chipId === largestChipId ||
            t.pins[1].chipId === largestChipId,
        )

  if (hostCandidates.length > 0) {
    return hostCandidates.reduce((a, b) =>
      lengthOfTrace(a) >= lengthOfTrace(b) ? a : b,
    )
  }

  return fallbackTrace
}
