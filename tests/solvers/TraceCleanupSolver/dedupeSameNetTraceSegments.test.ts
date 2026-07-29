import { expect, test } from "bun:test"
import { dedupeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/dedupeSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

test("dedupeSameNetTraceSegments removes duplicate same-net traces", () => {
  const traces = [
    makeTrace("a", "VCC", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("b", "VCC", [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]),
    makeTrace("c", "GND", [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]),
  ]

  expect(dedupeSameNetTraceSegments(traces).map((trace) => trace.mspPairId)).toEqual([
    "a",
    "c",
  ])
})

test("dedupeSameNetTraceSegments trims duplicate edge segments only when the remaining path is contiguous", () => {
  const traces = [
    makeTrace("a", "OUT", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("b", "OUT", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("c", "OUT", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ]),
    makeTrace("d", "OUT", [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 5, y: 1 },
      { x: 4, y: 1 },
    ]),
  ]

  const deduped = dedupeSameNetTraceSegments(traces)

  expect(deduped.find((trace) => trace.mspPairId === "b")!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(deduped.find((trace) => trace.mspPairId === "d")!.tracePath).toEqual([
    { x: 3, y: 0 },
    { x: 3, y: 1 },
    { x: 5, y: 1 },
    { x: 4, y: 1 },
  ])
})
