import { expect, test } from "bun:test"
import { mergeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const baseTrace = (
  id: string,
  net: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    globalConnNetId: net,
    dcConnNetId: net,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

test("aligns close horizontal interior segments on the same net", () => {
  const traces = [
    baseTrace("t1", "net_a", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.08 },
      { x: 2, y: 0.08 },
      { x: 2, y: 1 },
    ]),
    baseTrace("t2", "net_a", [
      { x: 0.5, y: 0 },
      { x: 1.5, y: 0 },
      { x: 1.5, y: 0.05 },
      { x: 2.5, y: 0.05 },
      { x: 2.5, y: 1 },
    ]),
  ]

  const merged = mergeSameNetTraceSegments(traces, { tolerance: 0.12 })
  expect(merged[1]!.tracePath[2]!.y).toBe(0.08)
  expect(merged[1]!.tracePath[3]!.y).toBe(0.08)
})

test("does not align segments on different nets", () => {
  const traces = [
    baseTrace("t1", "net_a", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.08 },
      { x: 2, y: 0.08 },
      { x: 2, y: 1 },
    ]),
    baseTrace("t2", "net_b", [
      { x: 0.5, y: 0 },
      { x: 1.5, y: 0 },
      { x: 1.5, y: 0.05 },
      { x: 2.5, y: 0.05 },
      { x: 2.5, y: 1 },
    ]),
  ]

  const merged = mergeSameNetTraceSegments(traces, { tolerance: 0.12 })
  expect(merged[1]!.tracePath[2]!.y).toBe(0.05)
})

test("aligns close vertical interior segments on the same net", () => {
  const traces = [
    baseTrace("t1", "net_a", [
      { x: 0, y: 0 },
      { x: 0.07, y: 0 },
      { x: 0.07, y: 1 },
      { x: 0.07, y: 2 },
      { x: 1, y: 2 },
    ]),
    baseTrace("t2", "net_a", [
      { x: 0, y: 0.5 },
      { x: 0.1, y: 0.5 },
      { x: 0.1, y: 1.5 },
      { x: 0.1, y: 2.5 },
      { x: 1, y: 2.5 },
    ]),
  ]

  const merged = mergeSameNetTraceSegments(traces, { tolerance: 0.12 })
  expect(merged[1]!.tracePath[1]!.x).toBe(0.07)
  expect(merged[1]!.tracePath[2]!.x).toBe(0.07)
})
