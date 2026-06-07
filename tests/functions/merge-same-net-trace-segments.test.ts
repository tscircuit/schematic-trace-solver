import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraceSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as SolvedTracePath

test("mergeSameNetTraceSegments aligns close parallel same-net segments", () => {
  const [a, b] = mergeSameNetTraceSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 2 },
      { x: 0, y: 1.1 },
      { x: 3, y: 1.1 },
      { x: 3, y: 2 },
    ]),
  ])

  expect(a!.tracePath[1]!.y).toBe(1.05)
  expect(a!.tracePath[2]!.y).toBe(1.05)
  expect(b!.tracePath[1]!.y).toBe(1.05)
  expect(b!.tracePath[2]!.y).toBe(1.05)
})

test("mergeSameNetTraceSegments does not align different nets", () => {
  const [a, b] = mergeSameNetTraceSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ]),
    makeTrace("b", "net2", [
      { x: 0, y: 2 },
      { x: 0, y: 1.1 },
      { x: 3, y: 1.1 },
      { x: 3, y: 2 },
    ]),
  ])

  expect(a!.tracePath[1]!.y).toBe(1)
  expect(b!.tracePath[1]!.y).toBe(1.1)
})
