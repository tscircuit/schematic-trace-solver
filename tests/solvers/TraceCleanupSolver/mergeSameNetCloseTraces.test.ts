import { test, expect } from "bun:test"
import { mergeSameNetCloseTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: { x: number; y: number }[],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    pins: [],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as unknown as SolvedTracePath

test("merges two parallel same-net horizontal segments that are close", () => {
  // Two same-net traces with nearly aligned horizontal middle segments.
  // path A goes (0,0) -> (0,1) -> (5,1) -> (5,2)
  // path B goes (0,0) -> (0,1.05) -> (5,1.05) -> (5,2)
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1.05 },
      { x: 5, y: 1.05 },
      { x: 5, y: 2 },
    ]),
  ]

  const merged = mergeSameNetCloseTraces(traces)

  // The middle horizontal segments should now share the same Y value.
  const aMidY = merged[0]!.tracePath[1]!.y
  const bMidY = merged[1]!.tracePath[1]!.y
  expect(Math.abs(aMidY - bMidY)).toBeLessThan(1e-6)
  expect(merged[0]!.tracePath[2]!.y).toBeCloseTo(aMidY)
  expect(merged[1]!.tracePath[2]!.y).toBeCloseTo(bMidY)
})

test("merges two parallel same-net vertical segments that are close", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 0 },
      { x: 1.05, y: 0 },
      { x: 1.05, y: 5 },
      { x: 2, y: 5 },
    ]),
  ]

  const merged = mergeSameNetCloseTraces(traces)
  expect(
    Math.abs(merged[0]!.tracePath[1]!.x - merged[1]!.tracePath[1]!.x),
  ).toBeLessThan(1e-6)
})

test("does not merge segments from different nets", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
    ]),
    makeTrace("b", "net2", [
      { x: 0, y: 0 },
      { x: 0, y: 1.05 },
      { x: 5, y: 1.05 },
      { x: 5, y: 2 },
    ]),
  ]

  const merged = mergeSameNetCloseTraces(traces)
  expect(merged[0]!.tracePath[1]!.y).toBe(1)
  expect(merged[1]!.tracePath[1]!.y).toBe(1.05)
})

test("does not merge segments that are too far apart", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
    ]),
  ]

  const merged = mergeSameNetCloseTraces(traces)
  expect(merged[0]!.tracePath[1]!.y).toBe(1)
  expect(merged[1]!.tracePath[1]!.y).toBe(3)
})

test("does not move endpoint segments connected to pins", () => {
  // Both traces only have endpoint segments — should not be modified.
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 1 },
      { x: 5, y: 1 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 1.05 },
      { x: 5, y: 1.05 },
    ]),
  ]

  const merged = mergeSameNetCloseTraces(traces)
  expect(merged[0]!.tracePath[0]!.y).toBe(1)
  expect(merged[1]!.tracePath[0]!.y).toBe(1.05)
})

test("does not merge non-overlapping parallel segments", () => {
  // Same-net, parallel, close Y, but x-ranges do not overlap.
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 3, y: 0 },
      { x: 3, y: 1.05 },
      { x: 5, y: 1.05 },
      { x: 5, y: 2 },
    ]),
  ]

  const merged = mergeSameNetCloseTraces(traces)
  expect(merged[0]!.tracePath[1]!.y).toBe(1)
  expect(merged[1]!.tracePath[1]!.y).toBe(1.05)
})
