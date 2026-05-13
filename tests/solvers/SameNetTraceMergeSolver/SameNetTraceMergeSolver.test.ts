import { expect, test } from "bun:test"
import { mergeSameNetTraceSegments } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
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
    tracePath,
    mspConnectionPairIds: [id],
    pinIds: [],
  }) as SolvedTracePath

test("merges close collinear same-net trace segment endpoints", () => {
  const traces = mergeSameNetTraceSegments({
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    gapThreshold: 0.15,
  })

  expect(traces[0]!.tracePath[1]).toEqual({ x: 1.05, y: 0 })
  expect(traces[1]!.tracePath[0]).toEqual({ x: 1.05, y: 0 })
})

test("does not merge close endpoints from different nets", () => {
  const traces = mergeSameNetTraceSegments({
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    gapThreshold: 0.15,
  })

  expect(traces[0]!.tracePath[1]).toEqual({ x: 1, y: 0 })
  expect(traces[1]!.tracePath[0]).toEqual({ x: 1.1, y: 0 })
})

test("does not merge same-net endpoints beyond the gap threshold", () => {
  const traces = mergeSameNetTraceSegments({
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 1.3, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    gapThreshold: 0.15,
  })

  expect(traces[0]!.tracePath[1]).toEqual({ x: 1, y: 0 })
  expect(traces[1]!.tracePath[0]).toEqual({ x: 1.3, y: 0 })
})
