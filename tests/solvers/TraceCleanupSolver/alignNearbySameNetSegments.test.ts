import { expect, test } from "bun:test"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  netId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [id],
    tracePath,
  }) as SolvedTracePath

test("alignNearbySameNetSegments aligns close overlapping same-net internal segments", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 3 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 4 },
    ]),
  ]

  const output = alignNearbySameNetSegments(traces, { tolerance: 0.1 })

  expect(output[1]!.tracePath[1]!.y).toBe(1)
  expect(output[1]!.tracePath[2]!.y).toBe(1)
})

test("alignNearbySameNetSegments does not align different nets", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ]),
    makeTrace("b", "net2", [
      { x: 1, y: 3 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 4 },
    ]),
  ]

  const output = alignNearbySameNetSegments(traces, { tolerance: 0.1 })

  expect(output[1]!.tracePath[1]!.y).toBe(1.08)
  expect(output[1]!.tracePath[2]!.y).toBe(1.08)
})

test("alignNearbySameNetSegments leaves endpoint-only segments anchored", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 4 },
    ]),
  ]

  const output = alignNearbySameNetSegments(traces, { tolerance: 0.1 })

  expect(output[1]!.tracePath[0]!.y).toBe(1.08)
  expect(output[1]!.tracePath[1]!.y).toBe(1.08)
})

test("alignNearbySameNetSegments rejects moves that intersect a different net", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 3 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 4 },
    ]),
    makeTrace("c", "net2", [
      { x: 2, y: 0.5 },
      { x: 2, y: 1.04 },
      { x: 2.5, y: 1.04 },
    ]),
  ]

  const output = alignNearbySameNetSegments(traces, { tolerance: 0.1 })

  expect(output[1]!.tracePath[1]!.y).toBe(1.08)
  expect(output[1]!.tracePath[2]!.y).toBe(1.08)
})
