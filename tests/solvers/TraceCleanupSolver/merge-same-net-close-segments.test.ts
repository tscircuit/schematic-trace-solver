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

test("aligns close same-net horizontal segments away from endpoints", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 0.08 },
      { x: 1, y: 0.08 },
      { x: 1, y: 1.08 },
      { x: 4, y: 1.08 },
      { x: 4, y: 2.08 },
      { x: 5, y: 2.08 },
    ]),
  ]

  const result = mergeSameNetCloseSegments({ traces, tolerance: 0.1 })

  expect(result[0]!.tracePath[2]!.y).toBe(1.04)
  expect(result[0]!.tracePath[3]!.y).toBe(1.04)
  expect(result[1]!.tracePath[2]!.y).toBe(1.04)
  expect(result[1]!.tracePath[3]!.y).toBe(1.04)
  expect(result[0]!.tracePath[0]!.y).toBe(0)
  expect(result[0]!.tracePath[1]!.y).toBe(0)
  expect(result[0]!.tracePath[4]!.y).toBe(2)
  expect(result[0]!.tracePath[5]!.y).toBe(2)
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

test("does not move internal segments that share endpoint-adjacent vertices", () => {
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

  expect(result[0]!.tracePath[1]!.y).toBe(1)
  expect(result[0]!.tracePath[2]!.y).toBe(1)
  expect(result[1]!.tracePath[1]!.y).toBe(1.08)
  expect(result[1]!.tracePath[2]!.y).toBe(1.08)
})

test("does not merge same-net segments into an overlapping different-net segment", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: -1, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]),
    makeTrace("b", "net1", [
      { x: -1, y: -0.9 },
      { x: -1, y: 0.1 },
      { x: 0, y: 0.1 },
      { x: 2, y: 0.1 },
      { x: 2, y: 1.1 },
      { x: 3, y: 1.1 },
    ]),
    makeTrace("c", "net2", [
      { x: -1, y: -0.95 },
      { x: -1, y: 0.05 },
      { x: 0, y: 0.05 },
      { x: 2, y: 0.05 },
      { x: 2, y: 1.05 },
      { x: 3, y: 1.05 },
    ]),
  ]

  const result = mergeSameNetCloseSegments({ traces, tolerance: 0.11 })

  expect(result[0]!.tracePath[2]!.y).toBe(0)
  expect(result[0]!.tracePath[3]!.y).toBe(0)
  expect(result[1]!.tracePath[2]!.y).toBe(0.1)
  expect(result[1]!.tracePath[3]!.y).toBe(0.1)
  expect(result[2]!.tracePath[2]!.y).toBe(0.05)
  expect(result[2]!.tracePath[3]!.y).toBe(0.05)
})

test("does not merge same-net segments into a crossing different-net segment", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: -1, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]),
    makeTrace("b", "net1", [
      { x: -1, y: -0.9 },
      { x: -1, y: 0.1 },
      { x: 0, y: 0.1 },
      { x: 2, y: 0.1 },
      { x: 2, y: 1.1 },
      { x: 3, y: 1.1 },
    ]),
    makeTrace("c", "net2", [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0.03 },
      { x: 1, y: 0.07 },
      { x: 2, y: 0.07 },
      { x: 3, y: 0.07 },
    ]),
  ]

  const result = mergeSameNetCloseSegments({ traces, tolerance: 0.11 })

  expect(result[0]!.tracePath[2]!.y).toBe(0)
  expect(result[0]!.tracePath[3]!.y).toBe(0)
  expect(result[1]!.tracePath[2]!.y).toBe(0.1)
  expect(result[1]!.tracePath[3]!.y).toBe(0.1)
  expect(result[2]!.tracePath[2]!.x).toBe(1)
  expect(result[2]!.tracePath[3]!.x).toBe(1)
})
