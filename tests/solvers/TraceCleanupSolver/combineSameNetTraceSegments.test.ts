import { expect, test } from "bun:test"
import { combineSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/combineSameNetTraceSegments"
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
    pins: [] as any,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as SolvedTracePath

test("combines close overlapping same-net segments without moving endpoints", () => {
  const traces = combineSameNetTraceSegments({
    maxDistance: 0.1,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 2, y: 0 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 0 },
      ]),
    ],
  })

  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ])
  expect(traces[1]!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 8, y: 0 },
  ])
})

test("does not combine close segments from different nets", () => {
  const traces = combineSameNetTraceSegments({
    maxDistance: 0.1,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 2, y: 0 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 0 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 2, y: 0.08 },
    { x: 8, y: 0.08 },
    { x: 8, y: 0 },
  ])
})

test("combines close overlapping segments within a single same-net trace", () => {
  const traces = combineSameNetTraceSegments({
    maxDistance: 0.1,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0.08 },
        { x: 2, y: 0.08 },
        { x: 2, y: 0 },
      ]),
    ],
  })

  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("does not move segments that are anchored to endpoints", () => {
  const traces = combineSameNetTraceSegments({
    maxDistance: 0.1,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 0.08 },
        { x: 10, y: 0.08 },
      ]),
    ],
  })

  expect(traces[1]!.tracePath).toEqual([
    { x: 0, y: 0.08 },
    { x: 10, y: 0.08 },
  ])
})
