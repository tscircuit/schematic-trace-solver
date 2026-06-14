import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }) as SolvedTracePath

test("aligns nearby same-net horizontal segments to the same y", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "N1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "N1", [
      { x: 1, y: 0.1 },
      { x: 5, y: 0.1 },
    ]),
  ])

  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.05 },
    { x: 4, y: 0.05 },
    { x: 4, y: 0 },
  ])
  expect(traces[1]!.tracePath).toEqual([
    { x: 1, y: 0.1 },
    { x: 1, y: 0.05 },
    { x: 5, y: 0.05 },
    { x: 5, y: 0.1 },
  ])
})

test("does not align segments from different nets", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "N1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "N2", [
      { x: 1, y: 0.1 },
      { x: 5, y: 0.1 },
    ]),
  ])

  expect(traces[0]!.tracePath[0]!.y).toBe(0)
  expect(traces[1]!.tracePath[0]!.y).toBe(0.1)
})
