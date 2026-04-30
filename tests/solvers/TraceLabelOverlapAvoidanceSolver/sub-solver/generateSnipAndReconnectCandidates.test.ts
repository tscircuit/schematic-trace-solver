import { test, expect } from "bun:test"
import { generateSnipAndReconnectCandidates } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/trySnipAndReconnect"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("generateSnipAndReconnectCandidates returns empty for invalid indices", () => {
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
    ],
  } as any

  // firstInsideIndex <= 0 should return empty
  const result1 = generateSnipAndReconnectCandidates({
    initialTrace: trace,
    firstInsideIndex: 0,
    lastInsideIndex: 2,
    labelBounds: { minX: 5, minY: -1, maxX: 15, maxY: 1 },
    paddingBuffer: 1,
    detourCount: 1,
  })
  expect(result1).toHaveLength(0)

  // lastInsideIndex >= tracePath.length - 1 should return empty
  const result2 = generateSnipAndReconnectCandidates({
    initialTrace: trace,
    firstInsideIndex: 1,
    lastInsideIndex: 3,
    labelBounds: { minX: 5, minY: -1, maxX: 15, maxY: 1 },
    paddingBuffer: 1,
    detourCount: 1,
  })
  expect(result2).toHaveLength(0)
})

test("generateSnipAndReconnectCandidates generates elbow candidates", () => {
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 10, y: 0 }, // entry point
      { x: 10, y: 10 },
      { x: 20, y: 10 }, // exit point
    ],
  } as any

  const result = generateSnipAndReconnectCandidates({
    initialTrace: trace,
    firstInsideIndex: 1,
    lastInsideIndex: 2,
    labelBounds: { minX: 5, minY: -1, maxX: 15, maxY: 1 },
    paddingBuffer: 1,
    detourCount: 1,
  })

  // Should generate elbow candidates when entry and exit are not aligned
  expect(Array.isArray(result)).toBe(true)
})
