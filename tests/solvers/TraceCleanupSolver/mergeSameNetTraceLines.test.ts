import { expect, test } from "bun:test"
import { mergeSameNetTraceLines } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraceLines"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as SolvedTracePath

test("mergeSameNetTraceLines aligns close same-net horizontal segments", () => {
  const traces = mergeSameNetTraceLines({
    maxDistance: 0.1,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0.2, y: 0 },
        { x: 0.2, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 2 },
        { x: 0.4, y: 2 },
        { x: 0.4, y: 1.06 },
        { x: 1.6, y: 1.06 },
        { x: 1.6, y: 2 },
        { x: 3, y: 2 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath[2]!.y).toBe(1)
  expect(traces[1]!.tracePath[3]!.y).toBe(1)
})

test("mergeSameNetTraceLines does not align different-net segments", () => {
  const traces = mergeSameNetTraceLines({
    maxDistance: 0.1,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0.2, y: 0 },
        { x: 0.2, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 0, y: 2 },
        { x: 0.4, y: 2 },
        { x: 0.4, y: 1.06 },
        { x: 1.6, y: 1.06 },
        { x: 1.6, y: 2 },
        { x: 3, y: 2 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath[2]!.y).toBe(1.06)
  expect(traces[1]!.tracePath[3]!.y).toBe(1.06)
})

test("mergeSameNetTraceLines aligns close same-net vertical segments", () => {
  const traces = mergeSameNetTraceLines({
    maxDistance: 0.1,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 0.2 },
        { x: 1, y: 0.2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ]),
      makeTrace("b", "net1", [
        { x: 2, y: 0 },
        { x: 2, y: 0.4 },
        { x: 1.06, y: 0.4 },
        { x: 1.06, y: 1.6 },
        { x: 2, y: 1.6 },
        { x: 2, y: 3 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath[2]!.x).toBe(1)
  expect(traces[1]!.tracePath[3]!.x).toBe(1)
})
