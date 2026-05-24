import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  dedupeSameNetTraceSegments,
  getSameNetTraceSegmentKey,
} from "lib/solvers/SchematicTracePipelineSolver/dedupeSameNetTraceSegments"

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as any

test("dedupeSameNetTraceSegments trims duplicate endpoint segments in the same net", () => {
  const traces = dedupeSameNetTraceSegments([
    trace("a", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
    trace("b", "net-1", [
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]),
  ])

  expect(traces[1]!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 1, y: 0 },
  ])
})

test("dedupeSameNetTraceSegments keeps matching segments on different nets", () => {
  const traces = dedupeSameNetTraceSegments([
    trace("a", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    trace("b", "net-2", [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]),
  ])

  expect(traces[1]!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ])
})

test("getSameNetTraceSegmentKey treats reversed segment direction as duplicate", () => {
  expect(
    getSameNetTraceSegmentKey("net-1", { x: 0, y: 0 }, { x: 1, y: 0 }),
  ).toBe(getSameNetTraceSegmentKey("net-1", { x: 1, y: 0 }, { x: 0, y: 0 }))
})
