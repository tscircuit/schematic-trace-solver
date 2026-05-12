import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/same-net-trace-segment-merging"

const makeTrace = (
  id: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-a`, `${id}-b`],
    pins: [
      { pinId: `${id}-a`, chipId: "U1", x: 0, y: 0 },
      { pinId: `${id}-b`, chipId: "U2", x: 0, y: 0 },
    ],
    tracePath,
  }) as SolvedTracePath

test("aligns close horizontal same-net interior segments", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: -3, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: -3, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0.05 },
      { x: 1, y: 0.05 },
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ]),
  ]

  const merged = mergeSameNetTraceSegments(traces, { maxOffset: 0.1 })

  expect(merged[1]!.tracePath[2]!.y).toBeCloseTo(0)
  expect(merged[1]!.tracePath[3]!.y).toBeCloseTo(0)
})

test("does not move endpoint segments or different nets", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: -3, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("b", "net2", [
      { x: -3, y: 0.05 },
      { x: 3, y: 0.05 },
    ]),
  ]

  const merged = mergeSameNetTraceSegments(traces, { maxOffset: 0.1 })

  expect(merged[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(merged[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("does not create diagonal neighbors when merging same-net segments", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: -3, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: -1, y: 0.05 },
      { x: 1, y: 0.05 },
    ]),
  ]

  const merged = mergeSameNetTraceSegments(traces, { maxOffset: 0.1 })

  expect(merged[0]!.tracePath).toEqual(traces[0]!.tracePath)
})
