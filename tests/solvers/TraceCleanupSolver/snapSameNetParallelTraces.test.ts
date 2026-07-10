import { test, expect } from "bun:test"
import { snapSameNetParallelTraces } from "lib/solvers/TraceCleanupSolver/snapSameNetParallelTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [] as any,
  }
}

test("snaps two close horizontal segments on the same net to the same Y", () => {
  // Trace A: horizontal at y=0, from x=0 to x=2 (internal segment)
  const traceA = makeTrace("a", "net1", [
    { x: -1, y: 0 }, // anchor
    { x: 0, y: 0 }, // internal start
    { x: 2, y: 0 }, // internal end
    { x: 3, y: 0 }, // anchor
  ])
  // Trace B: horizontal at y=0.1 (close!), from x=0.5 to x=2.5
  const traceB = makeTrace("b", "net1", [
    { x: -1, y: 0.1 },
    { x: 0.5, y: 0.1 },
    { x: 2.5, y: 0.1 },
    { x: 3, y: 0.1 },
  ])

  const result = snapSameNetParallelTraces([traceA, traceB])

  // Both internal segments should be snapped to midpoint y=0.05
  const mid = 0.05
  expect(result[0].tracePath[1].y).toBeCloseTo(mid)
  expect(result[0].tracePath[2].y).toBeCloseTo(mid)
  expect(result[1].tracePath[1].y).toBeCloseTo(mid)
  expect(result[1].tracePath[2].y).toBeCloseTo(mid)
  // Anchors should be unchanged
  expect(result[0].tracePath[0].y).toBe(0)
  expect(result[0].tracePath[3].y).toBe(0)
  expect(result[1].tracePath[0].y).toBe(0.1)
  expect(result[1].tracePath[3].y).toBe(0.1)
})

test("snaps two close vertical segments on the same net to the same X", () => {
  const traceA = makeTrace("a", "net1", [
    { x: 0, y: -1 },
    { x: 0, y: 0 },
    { x: 0, y: 2 },
    { x: 0, y: 3 },
  ])
  const traceB = makeTrace("b", "net1", [
    { x: 0.1, y: -1 },
    { x: 0.1, y: 0.5 },
    { x: 0.1, y: 2.5 },
    { x: 0.1, y: 3 },
  ])

  const result = snapSameNetParallelTraces([traceA, traceB])

  const mid = 0.05
  expect(result[0].tracePath[1].x).toBeCloseTo(mid)
  expect(result[0].tracePath[2].x).toBeCloseTo(mid)
  expect(result[1].tracePath[1].x).toBeCloseTo(mid)
  expect(result[1].tracePath[2].x).toBeCloseTo(mid)
})

test("does not snap segments on different nets", () => {
  const traceA = makeTrace("a", "net1", [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ])
  const traceB = makeTrace("b", "net2", [
    { x: -1, y: 0.05 },
    { x: 0, y: 0.05 },
    { x: 2, y: 0.05 },
    { x: 3, y: 0.05 },
  ])

  const result = snapSameNetParallelTraces([traceA, traceB])

  expect(result[0].tracePath[1].y).toBe(0)
  expect(result[1].tracePath[1].y).toBe(0.05)
})

test("does not snap segments farther apart than threshold", () => {
  const traceA = makeTrace("a", "net1", [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ])
  const traceB = makeTrace("b", "net1", [
    { x: -1, y: 0.5 },
    { x: 0, y: 0.5 },
    { x: 2, y: 0.5 },
    { x: 3, y: 0.5 },
  ])

  const result = snapSameNetParallelTraces([traceA, traceB])

  expect(result[0].tracePath[1].y).toBe(0)
  expect(result[1].tracePath[1].y).toBe(0.5)
})

test("does not snap segments with non-overlapping ranges", () => {
  const traceA = makeTrace("a", "net1", [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("b", "net1", [
    { x: 3, y: 0.1 },
    { x: 4, y: 0.1 },
    { x: 5, y: 0.1 },
    { x: 6, y: 0.1 },
  ])

  const result = snapSameNetParallelTraces([traceA, traceB])

  expect(result[0].tracePath[1].y).toBe(0)
  expect(result[1].tracePath[1].y).toBe(0.1)
})

test("does not modify anchor (first and last) segments", () => {
  // Trace with only 3 points: first-to-second is an anchor segment (si starts at 1)
  // With path length 3, internal segments are si in [1, length-2) = [1, 1) => empty
  const traceA = makeTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ])
  const traceB = makeTrace("b", "net1", [
    { x: 0, y: 0.1 },
    { x: 2, y: 0.1 },
    { x: 3, y: 0.1 },
  ])

  const result = snapSameNetParallelTraces([traceA, traceB])

  // No internal segments, nothing should change
  expect(result[0].tracePath[1].y).toBe(0)
  expect(result[1].tracePath[1].y).toBe(0.1)
})
