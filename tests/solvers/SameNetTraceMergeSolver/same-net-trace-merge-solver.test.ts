import { expect, test } from "bun:test"
import { mergeCloseSameNetTraceSegments } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  netId: string,
  tracePath: SolvedTracePath["tracePath"],
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

test("aligns close overlapping same-net horizontal trace segments", () => {
  const traces = mergeCloseSameNetTraceSegments({
    mergeDistance: 0.1,
    traces: [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 1, y: 2 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 2 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath[1]!.y).toBe(1)
  expect(traces[1]!.tracePath[2]!.y).toBe(1)
})

test("aligns close overlapping same-net vertical trace segments", () => {
  const traces = mergeCloseSameNetTraceSegments({
    mergeDistance: 0.1,
    traces: [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ]),
      makeTrace("b", "N1", [
        { x: 2, y: 1 },
        { x: 1.05, y: 1 },
        { x: 1.05, y: 3 },
        { x: 2, y: 3 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath[1]!.x).toBe(1)
  expect(traces[1]!.tracePath[2]!.x).toBe(1)
})

test("does not align different-net trace segments", () => {
  const traces = mergeCloseSameNetTraceSegments({
    mergeDistance: 0.1,
    traces: [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N2", [
        { x: 1, y: 2 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 2 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath[1]!.y).toBe(1.05)
  expect(traces[1]!.tracePath[2]!.y).toBe(1.05)
})
