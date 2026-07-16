import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeNearbySameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetTraceSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: globalConnNetId,
    pins: [
      {
        pinId: `${mspPairId}.1`,
        chipId: "U1",
        x: tracePath[0]!.x,
        y: tracePath[0]!.y,
      },
      {
        pinId: `${mspPairId}.2`,
        chipId: "U2",
        x: tracePath[tracePath.length - 1]!.x,
        y: tracePath[tracePath.length - 1]!.y,
      },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
  }) as SolvedTracePath

test("snaps close same-net horizontal middle segments to the same y", () => {
  const traces = [
    makeTrace("trace-a", "connectivity_net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ]),
    makeTrace("trace-b", "connectivity_net1", [
      { x: 0, y: 2 },
      { x: 0, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 2 },
    ]),
  ]

  const result = mergeNearbySameNetTraceSegments(traces, { snapDistance: 0.1 })

  expect(result.mergeCount).toBe(1)
  expect(result.traces[0]!.tracePath[1]!.y).toBeCloseTo(1.04)
  expect(result.traces[0]!.tracePath[2]!.y).toBeCloseTo(1.04)
  expect(result.traces[1]!.tracePath[1]!.y).toBeCloseTo(1.04)
  expect(result.traces[1]!.tracePath[2]!.y).toBeCloseTo(1.04)
  expect(result.traces[0]!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(result.traces[1]!.tracePath[3]).toEqual({ x: 3, y: 2 })
})

test("snaps close same-net vertical middle segments to the same x", () => {
  const traces = [
    makeTrace("trace-a", "connectivity_net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ]),
    makeTrace("trace-b", "connectivity_net1", [
      { x: 2, y: 0 },
      { x: 1.07, y: 0 },
      { x: 1.07, y: 3 },
      { x: 2, y: 3 },
    ]),
  ]

  const result = mergeNearbySameNetTraceSegments(traces, { snapDistance: 0.1 })

  expect(result.mergeCount).toBe(1)
  expect(result.traces[0]!.tracePath[1]!.x).toBeCloseTo(1.035)
  expect(result.traces[0]!.tracePath[2]!.x).toBeCloseTo(1.035)
  expect(result.traces[1]!.tracePath[1]!.x).toBeCloseTo(1.035)
  expect(result.traces[1]!.tracePath[2]!.x).toBeCloseTo(1.035)
})

test("does not snap close segments from different nets", () => {
  const traces = [
    makeTrace("trace-a", "connectivity_net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ]),
    makeTrace("trace-b", "connectivity_net2", [
      { x: 0, y: 2 },
      { x: 0, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 2 },
    ]),
  ]

  const result = mergeNearbySameNetTraceSegments(traces, { snapDistance: 0.1 })

  expect(result.mergeCount).toBe(0)
  expect(result.traces[0]!.tracePath[1]!.y).toBe(1)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(1.08)
})

test("leaves endpoint-only segments in place", () => {
  const traces = [
    makeTrace("trace-a", "connectivity_net1", [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
    ]),
    makeTrace("trace-b", "connectivity_net1", [
      { x: 0, y: 1.05 },
      { x: 3, y: 1.05 },
    ]),
  ]

  const result = mergeNearbySameNetTraceSegments(traces, { snapDistance: 0.1 })

  expect(result.mergeCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.traces[1]!.tracePath).toEqual(traces[1]!.tracePath)
})
