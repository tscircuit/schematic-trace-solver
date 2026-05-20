import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { combineSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/combineSameNetTraceSegments"

const makeTrace = (
  mspPairId: string,
  userNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: userNetId,
    globalConnNetId: userNetId,
    userNetId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }) as SolvedTracePath

test("combines close parallel segments on the same net", () => {
  const traces = [
    makeTrace("a", "VCC", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "VCC", [
      { x: 1, y: 1 },
      { x: 1, y: 0.06 },
      { x: 3, y: 0.06 },
      { x: 3, y: 1 },
    ]),
    makeTrace("c", "GND", [
      { x: 1, y: 0.04 },
      { x: 3, y: 0.04 },
    ]),
  ]

  const result = combineSameNetTraceSegments(traces, {
    distanceThreshold: 0.1,
  })

  expect(result[1]!.tracePath).toEqual([
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
  ])
  expect(result[2]!.tracePath).toEqual(traces[2]!.tracePath)
})
