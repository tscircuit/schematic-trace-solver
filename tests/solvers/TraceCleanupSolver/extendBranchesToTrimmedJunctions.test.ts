import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { extendBranchesToTrimmedJunctions } from "lib/solvers/TraceCleanupSolver/extendBranchesToTrimmedJunctions"

const createTrace = (
  overrides: Partial<SolvedTracePath> &
    Pick<SolvedTracePath, "mspPairId" | "tracePath">,
): SolvedTracePath => ({
  mspPairId: overrides.mspPairId,
  dcConnNetId: overrides.dcConnNetId ?? "VREF",
  globalConnNetId: overrides.globalConnNetId ?? "connectivity_net_vref",
  userNetId: overrides.userNetId ?? "VREF",
  pins: overrides.pins ?? [
    { pinId: "P1", chipId: "C1", x: 0, y: 0 },
    { pinId: "P2", chipId: "C2", x: 1, y: 1 },
  ],
  pinIds: overrides.pinIds ?? ["P1", "P2"],
  tracePath: overrides.tracePath,
  mspConnectionPairIds: overrides.mspConnectionPairIds ?? [overrides.mspPairId],
})

test("extends a trimmed branch along its terminal axis when the host rail shifts parallel", () => {
  const originalRail = createTrace({
    mspPairId: "R1-R2",
    pins: [
      { pinId: "R1.2", chipId: "R1", x: 3.46, y: -1.665 },
      { pinId: "R2.1", chipId: "R2", x: 1.05, y: -2.105 },
    ],
    pinIds: ["R1.2", "R2.1"],
    tracePath: [
      { x: 3.46, y: -1.665 },
      { x: 3.46, y: -1.865 },
      { x: 3.46, y: -1.885 },
      { x: 1.05, y: -1.885 },
      { x: 1.05, y: -1.905 },
      { x: 1.05, y: -2.105 },
    ],
  })
  const updatedRail = createTrace({
    ...originalRail,
    tracePath: [
      { x: 3.46, y: -1.665 },
      { x: 3.46, y: -1.865 },
      { x: 1.05, y: -1.865 },
      { x: 1.05, y: -2.105 },
    ],
  })
  const branch = createTrace({
    mspPairId: "C3-R2",
    pins: [
      { pinId: "C3.1", chipId: "C3", x: 1.0845, y: -3.91 },
      { pinId: "R2.1", chipId: "R2", x: 1.05, y: -2.105 },
    ],
    pinIds: ["C3.1", "R2.1"],
    tracePath: [
      { x: 1.0845, y: -3.91 },
      { x: 1.0845, y: -3.71 },
      { x: 1.85, y: -3.71 },
      { x: 1.85, y: -1.885 },
    ],
  })

  const extended = extendBranchesToTrimmedJunctions({
    originalTrace: originalRail,
    updatedTrace: updatedRail,
    traces: [originalRail, branch],
  })

  expect(extended).not.toBeNull()
  const updatedBranch = extended!.find((trace) => trace.mspPairId === "C3-R2")!
  expect(updatedBranch.tracePath).toEqual([
    { x: 1.0845, y: -3.91 },
    { x: 1.0845, y: -3.71 },
    { x: 1.85, y: -3.71 },
    { x: 1.85, y: -1.865 },
  ])
})

test("rejects extending a branch when a different-net trace blocks the extension", () => {
  const originalRail = createTrace({
    mspPairId: "R1-R2",
    tracePath: [
      { x: 3.46, y: -1.665 },
      { x: 3.46, y: -1.885 },
      { x: 1.05, y: -1.885 },
      { x: 1.05, y: -2.105 },
    ],
  })
  const updatedRail = createTrace({
    mspPairId: "R1-R2",
    tracePath: [
      { x: 3.46, y: -1.665 },
      { x: 3.46, y: -1.865 },
      { x: 1.05, y: -1.865 },
      { x: 1.05, y: -2.105 },
    ],
  })
  const branch = createTrace({
    mspPairId: "C3-R2",
    pins: [
      { pinId: "C3.1", chipId: "C3", x: 1.0845, y: -3.91 },
      { pinId: "R2.1", chipId: "R2", x: 1.05, y: -2.105 },
    ],
    pinIds: ["C3.1", "R2.1"],
    tracePath: [
      { x: 1.0845, y: -3.91 },
      { x: 1.85, y: -3.91 },
      { x: 1.85, y: -1.885 },
    ],
  })
  const blockingTrace = createTrace({
    mspPairId: "OTHER",
    globalConnNetId: "connectivity_net_other",
    tracePath: [
      { x: 1.5, y: -1.875 },
      { x: 2.2, y: -1.875 },
    ],
  })

  const extended = extendBranchesToTrimmedJunctions({
    originalTrace: originalRail,
    updatedTrace: updatedRail,
    traces: [originalRail, branch, blockingTrace],
  })

  expect(extended).toBeNull()
})
