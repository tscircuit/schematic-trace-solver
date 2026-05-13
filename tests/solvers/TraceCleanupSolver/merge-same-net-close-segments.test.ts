import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetCloseSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseSegments"

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

test("aligns close same-net horizontal internal segments", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 0.08 },
      { x: 0, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 2.08 },
    ]),
  ]

  const result = mergeSameNetCloseSegments({ traces, tolerance: 0.1 })

  expect(result[0]!.tracePath[1]!.y).toBe(1.04)
  expect(result[0]!.tracePath[2]!.y).toBe(1.04)
  expect(result[1]!.tracePath[1]!.y).toBe(1.04)
  expect(result[1]!.tracePath[2]!.y).toBe(1.04)
})

test("does not align segments from different nets", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net2", [
      { x: 0, y: 0.08 },
      { x: 0, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 2.08 },
    ]),
  ]

  const result = mergeSameNetCloseSegments({ traces, tolerance: 0.1 })

  expect(result[0]!.tracePath[1]!.y).toBe(1)
  expect(result[1]!.tracePath[1]!.y).toBe(1.08)
})

test("does not move endpoint segments", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 2.08 },
    ]),
  ]

  const result = mergeSameNetCloseSegments({ traces, tolerance: 0.1 })

  expect(result[0]!.tracePath[0]!.y).toBe(1)
  expect(result[0]!.tracePath[1]!.y).toBe(1)
  expect(result[1]!.tracePath[0]!.y).toBe(1.08)
  expect(result[1]!.tracePath[1]!.y).toBe(1.08)
})
