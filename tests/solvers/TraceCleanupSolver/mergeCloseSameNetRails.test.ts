import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeCloseSameNetRails } from "lib/solvers/TraceCleanupSolver/mergeCloseSameNetRails"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: { x: number; y: number }[],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [],
    pinIds: [],
  }) as unknown as SolvedTracePath

test("merges two close horizontal same-net rails onto a shared Y", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2.1 },
      { x: 4, y: 2.1 },
      { x: 4, y: 0 },
    ]),
  ]

  const result = mergeCloseSameNetRails({ traces })

  expect(result.mergedRailGroupCount).toBe(1)
  expect(result.mergedTraceCount).toBe(2)
  // Both horizontal rails now share the same Y coordinate.
  const y1 = result.traces[0]!.tracePath[1]!.y
  const y2 = result.traces[1]!.tracePath[1]!.y
  expect(y1).toBe(y2)
  // Length-weighted average of 2.0 (len 4) and 2.1 (len 4) => 2.05.
  expect(y1).toBeCloseTo(2.05, 5)
})

test("does not merge rails belonging to different nets", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "netB", [
      { x: 0, y: 0 },
      { x: 0, y: 2.1 },
      { x: 4, y: 2.1 },
      { x: 4, y: 0 },
    ]),
  ]

  const result = mergeCloseSameNetRails({ traces })

  expect(result.mergedRailGroupCount).toBe(0)
  expect(result.traces[0]!.tracePath[1]!.y).toBe(2)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(2.1)
})

test("does not merge rails that are farther apart than the threshold", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 4, y: 3 },
      { x: 4, y: 0 },
    ]),
  ]

  const result = mergeCloseSameNetRails({ traces })

  expect(result.mergedRailGroupCount).toBe(0)
  expect(result.traces[0]!.tracePath[1]!.y).toBe(2)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(3)
})

test("merges close vertical same-net rails onto a shared X", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ]),
    makeTrace("t2", "netA", [
      { x: 0, y: 0 },
      { x: 2.08, y: 0 },
      { x: 2.08, y: 4 },
      { x: 0, y: 4 },
    ]),
  ]

  const result = mergeCloseSameNetRails({ traces })

  expect(result.mergedRailGroupCount).toBe(1)
  const x1 = result.traces[0]!.tracePath[1]!.x
  const x2 = result.traces[1]!.tracePath[1]!.x
  expect(x1).toBe(x2)
  expect(x1).toBeCloseTo(2.04, 5)
})

test("respects eligibleTraceIds filter", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2.1 },
      { x: 4, y: 2.1 },
      { x: 4, y: 0 },
    ]),
  ]

  const result = mergeCloseSameNetRails({
    traces,
    eligibleTraceIds: new Set(["t1"]),
  })

  expect(result.mergedRailGroupCount).toBe(0)
})
