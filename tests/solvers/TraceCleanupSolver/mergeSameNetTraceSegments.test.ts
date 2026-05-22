import { expect, test } from "bun:test"
import { mergeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = ({
  mspPairId,
  globalConnNetId,
  tracePath,
}: Pick<
  SolvedTracePath,
  "mspPairId" | "globalConnNetId" | "tracePath"
>): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as any

test("mergeSameNetTraceSegments aligns close horizontal same-net segments", () => {
  const traces = mergeSameNetTraceSegments({
    tolerance: 0.1,
    traces: [
      makeTrace({
        mspPairId: "a",
        globalConnNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
      }),
      makeTrace({
        mspPairId: "b",
        globalConnNetId: "net1",
        tracePath: [
          { x: 1, y: 0.08 },
          { x: 3, y: 0.08 },
        ],
      }),
    ],
  })

  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 0.04 },
    { x: 2, y: 0.04 },
  ])
  expect(traces[1]!.tracePath).toEqual([
    { x: 1, y: 0.04 },
    { x: 3, y: 0.04 },
  ])
})

test("mergeSameNetTraceSegments leaves different-net segments alone", () => {
  const traces = mergeSameNetTraceSegments({
    tolerance: 0.1,
    traces: [
      makeTrace({
        mspPairId: "a",
        globalConnNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
      }),
      makeTrace({
        mspPairId: "b",
        globalConnNetId: "net2",
        tracePath: [
          { x: 1, y: 0.08 },
          { x: 3, y: 0.08 },
        ],
      }),
    ],
  })

  expect(traces[0]!.tracePath[0]!.y).toBe(0)
  expect(traces[1]!.tracePath[0]!.y).toBe(0.08)
})

test("mergeSameNetTraceSegments aligns close vertical same-net segments", () => {
  const traces = mergeSameNetTraceSegments({
    tolerance: 0.1,
    traces: [
      makeTrace({
        mspPairId: "a",
        globalConnNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 2 },
        ],
      }),
      makeTrace({
        mspPairId: "b",
        globalConnNetId: "net1",
        tracePath: [
          { x: 0.06, y: 1 },
          { x: 0.06, y: 3 },
        ],
      }),
    ],
  })

  expect(traces[0]!.tracePath).toEqual([
    { x: 0.03, y: 0 },
    { x: 0.03, y: 2 },
  ])
  expect(traces[1]!.tracePath).toEqual([
    { x: 0.03, y: 1 },
    { x: 0.03, y: 3 },
  ])
})
