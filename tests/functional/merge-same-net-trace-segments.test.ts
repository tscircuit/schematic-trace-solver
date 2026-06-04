import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraceSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
    pins: [] as any,
  }) as SolvedTracePath

test("merges close same-net horizontal trace segments", () => {
  const traces = mergeSameNetTraceSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 2.05, y: 0 },
      { x: 4, y: 0 },
    ]),
  ])

  expect(traces).toHaveLength(1)
  expect(traces[0]!.mspConnectionPairIds).toEqual(["a", "b"])
  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
})

test("does not merge traces from different nets", () => {
  const traces = mergeSameNetTraceSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b", "net2", [
      { x: 2.05, y: 0 },
      { x: 4, y: 0 },
    ]),
  ])

  expect(traces).toHaveLength(2)
})

test("does not merge distant same-net segments on the same axis", () => {
  const traces = mergeSameNetTraceSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 4, y: 0 },
      { x: 6, y: 0 },
    ]),
  ])

  expect(traces).toHaveLength(2)
})
