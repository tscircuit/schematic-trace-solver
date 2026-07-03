import { expect, test } from "bun:test"
import { alignCloseSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignCloseSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

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
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [mspPairId],
  }) as SolvedTracePath

test("aligns close overlapping internal horizontal segments on the same net", () => {
  const traces = alignCloseSameNetTraceSegments({
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0 },
      ]),
    ],
    mergeDistance: 0.1,
  })

  expect(traces[1]!.tracePath[2]!.y).toBe(1)
  expect(traces[1]!.tracePath[3]!.y).toBe(1)
})

test("does not align close segments across different nets", () => {
  const traces = alignCloseSameNetTraceSegments({
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0 },
      ]),
    ],
    mergeDistance: 0.1,
  })

  expect(traces[1]!.tracePath[2]!.y).toBe(1.08)
  expect(traces[1]!.tracePath[3]!.y).toBe(1.08)
})

test("does not move endpoint segments when aligning same-net traces", () => {
  const traces = alignCloseSameNetTraceSegments({
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0 },
      ]),
    ],
    mergeDistance: 0.1,
  })

  expect(traces[1]!.tracePath[0]!.y).toBe(1.08)
  expect(traces[1]!.tracePath[1]!.y).toBe(1.08)
})
