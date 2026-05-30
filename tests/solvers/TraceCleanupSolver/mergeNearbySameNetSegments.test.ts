import { expect, test } from "bun:test"
import { mergeNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [] as any,
  }) as SolvedTracePath

test("mergeNearbySameNetSegments snaps close same-net horizontal segments to a shared y", () => {
  const traces = [
    makeTrace("a", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 0 },
    ]),
    makeTrace("b", "net-1", [
      { x: 1, y: 3 },
      { x: 1, y: 1.18 },
      { x: 6, y: 1.18 },
      { x: 6, y: 3 },
    ]),
  ]

  const merged = mergeNearbySameNetSegments(traces, { maxDistance: 0.25 })

  expect(merged[0]!.tracePath[1]!.y).toBe(1)
  expect(merged[0]!.tracePath[2]!.y).toBe(1)
  expect(merged[1]!.tracePath[1]!.y).toBe(1)
  expect(merged[1]!.tracePath[2]!.y).toBe(1)
})

test("mergeNearbySameNetSegments snaps close same-net vertical segments to a shared x", () => {
  const traces = [
    makeTrace("a", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 5 },
      { x: 0, y: 5 },
    ]),
    makeTrace("b", "net-1", [
      { x: 3, y: 1 },
      { x: 1.18, y: 1 },
      { x: 1.18, y: 6 },
      { x: 3, y: 6 },
    ]),
  ]

  const merged = mergeNearbySameNetSegments(traces, { maxDistance: 0.25 })

  expect(merged[0]!.tracePath[1]!.x).toBe(1)
  expect(merged[0]!.tracePath[2]!.x).toBe(1)
  expect(merged[1]!.tracePath[1]!.x).toBe(1)
  expect(merged[1]!.tracePath[2]!.x).toBe(1)
})

test("mergeNearbySameNetSegments preserves endpoints and different-net traces", () => {
  const traces = [
    makeTrace("a", "net-1", [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
    ]),
    makeTrace("b", "net-1", [
      { x: 1, y: 0.18 },
      { x: 6, y: 0.18 },
      { x: 6, y: 3 },
    ]),
    makeTrace("c", "net-2", [
      { x: 1, y: 0.2 },
      { x: 1, y: 2 },
      { x: 6, y: 2 },
    ]),
  ]

  const merged = mergeNearbySameNetSegments(traces, { maxDistance: 0.25 })

  expect(merged[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(merged[1]!.tracePath).toEqual(traces[1]!.tracePath)
  expect(merged[2]!.tracePath).toEqual(traces[2]!.tracePath)
})
