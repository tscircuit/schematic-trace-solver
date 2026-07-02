import { expect, test } from "bun:test"
import { mergeCloseSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeCloseSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

test("merges close same-net parallel trace segments", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: -1 },
      { x: 1, y: 0.08 },
      { x: 4, y: 0.08 },
      { x: 4, y: 1 },
    ]),
  ]

  const result = mergeCloseSameNetTraceSegments(traces)

  expect(result[1]!.tracePath).toEqual([
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
  ])
})

test("does not merge close parallel trace segments from different nets", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("b", "net2", [
      { x: 1, y: -1 },
      { x: 1, y: 0.08 },
      { x: 4, y: 0.08 },
      { x: 4, y: 1 },
    ]),
  ]

  const result = mergeCloseSameNetTraceSegments(traces)

  expect(result[1]!.tracePath).toEqual([
    { x: 1, y: -1 },
    { x: 1, y: 0.08 },
    { x: 4, y: 0.08 },
    { x: 4, y: 1 },
  ])
})
