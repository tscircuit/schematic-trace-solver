import { test, expect } from "bun:test"
import { removeNetSegmentDuplicates } from "lib/solvers/TraceCleanupSolver/removeNetSegmentDuplicates"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: "p1", x: points[0].x, y: points[0].y, chipId: "c1" },
      {
        pinId: "p2",
        x: points[points.length - 1].x,
        y: points[points.length - 1].y,
        chipId: "c2",
      },
    ] as any,
    tracePath: points,
    mspConnectionPairIds: [id],
    pinIds: ["p1", "p2"],
  }
}

test("removeNetSegmentDuplicates: single trace unchanged", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
  ]
  const result = removeNetSegmentDuplicates(traces)
  expect(result).toHaveLength(1)
  expect(result[0].tracePath).toHaveLength(3)
})

test("removeNetSegmentDuplicates: different nets are not deduplicated", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net2", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
  ]
  const result = removeNetSegmentDuplicates(traces)
  expect(result).toHaveLength(2)
  expect(result[0].tracePath).toHaveLength(2)
  expect(result[1].tracePath).toHaveLength(2)
})

test("removeNetSegmentDuplicates: shared leading segment is trimmed", () => {
  // Two traces in the same net share a starting segment (0,0)-(1,0)
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
    makeTrace("t2", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: -1 },
    ]),
  ]
  const result = removeNetSegmentDuplicates(traces)
  expect(result).toHaveLength(2)
  // First trace keeps all segments
  expect(result[0].tracePath).toHaveLength(3)
  // Second trace has the shared leading segment trimmed
  expect(result[1].tracePath).toHaveLength(2)
  // Second trace should start at (1,0) instead of (0,0)
  expect(result[1].tracePath[0]).toEqual({ x: 1, y: 0 })
})

test("removeNetSegmentDuplicates: shared trailing segment is trimmed", () => {
  // Two traces in the same net share an ending segment (1,0)-(2,0)
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
  ]
  const result = removeNetSegmentDuplicates(traces)
  expect(result).toHaveLength(2)
  // First trace keeps all segments
  expect(result[0].tracePath).toHaveLength(3)
  // Second trace has the shared trailing segment trimmed
  expect(result[1].tracePath).toHaveLength(2)
  // Second trace should end at (1,0) instead of (2,0)
  expect(result[1].tracePath[result[1].tracePath.length - 1]).toEqual({
    x: 1,
    y: 0,
  })
})

test("removeNetSegmentDuplicates: reverse direction segment is detected", () => {
  // Two traces share a segment but traversed in opposite directions
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]),
  ]
  const result = removeNetSegmentDuplicates(traces)
  expect(result).toHaveLength(2)
  // First trace unchanged
  expect(result[0].tracePath).toHaveLength(3)
  // Second trace should have the shared trailing segment (1,0)-(0,0) trimmed
  expect(result[1].tracePath).toHaveLength(2)
  expect(result[1].tracePath[result[1].tracePath.length - 1]).toEqual({
    x: 1,
    y: 0,
  })
})
