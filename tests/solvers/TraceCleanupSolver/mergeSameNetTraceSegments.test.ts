import { expect, test } from "bun:test"
import { mergeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  userNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    userNetId,
    dcConnNetId: userNetId,
    globalConnNetId: userNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [] as any,
  }) as SolvedTracePath

test("aligns close overlapping horizontal segments on the same net", () => {
  const traces = mergeSameNetTraceSegments(
    [
      makeTrace("a", "GND", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "GND", [
        { x: 1, y: 3 },
        { x: 1, y: 1.05 },
        { x: 5, y: 1.05 },
        { x: 5, y: 3 },
      ]),
    ],
    { tolerance: 0.1 },
  )

  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 5, y: 1 })
})

test("aligns close overlapping vertical segments on the same net", () => {
  const traces = mergeSameNetTraceSegments(
    [
      makeTrace("a", "GND", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ]),
      makeTrace("b", "GND", [
        { x: 3, y: 1 },
        { x: 1.05, y: 1 },
        { x: 1.05, y: 5 },
        { x: 3, y: 5 },
      ]),
    ],
    { tolerance: 0.1 },
  )

  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 1, y: 5 })
})

test("does not align segments from different nets", () => {
  const traces = mergeSameNetTraceSegments(
    [
      makeTrace("a", "GND", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "VCC", [
        { x: 1, y: 3 },
        { x: 1, y: 1.05 },
        { x: 5, y: 1.05 },
        { x: 5, y: 3 },
      ]),
    ],
    { tolerance: 0.1 },
  )

  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1.05 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 5, y: 1.05 })
})
