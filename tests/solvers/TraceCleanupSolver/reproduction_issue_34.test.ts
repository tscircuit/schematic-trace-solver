import { test, expect } from "bun:test"
import { TraceCombineSolver } from "lib/solvers/TraceCleanupSolver/TraceCombineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("TraceCombineSolver - simple parallel horizontal merge", () => {
  //  Defines two parallel paths that are very close (Y difference of 0.02) and overlap in X.
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    globalConnNetId: "net1",
    dcConnNetId: "dc1",
    tracePath: [
      { x: 0, y: 1.0 },
      { x: 2, y: 1.0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pins: [] as any,
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    globalConnNetId: "net1",
    dcConnNetId: "dc1",
    tracePath: [
      { x: 1, y: 1.02 },
      { x: 3, y: 1.02 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pins: [] as any,
  }

  // Run the combine solver
  const result = TraceCombineSolver.tryCombineParallelTraces(
    [trace1, trace2],
    0.05,
  )

  // Verify that both horizontal segments have been shifted to the average Y coordinate (1.01)
  expect(result[0].tracePath[0].y).toBeCloseTo(1.01, 5)
  expect(result[0].tracePath[1].y).toBeCloseTo(1.01, 5)

  expect(result[1].tracePath[0].y).toBeCloseTo(1.01, 5)
  expect(result[1].tracePath[1].y).toBeCloseTo(1.01, 5)
})

test("TraceCombineSolver - connected multi-segment orthogonal stretching", () => {
  // Trace 1: Vertical (0,0)->(0,1) then Horizontal (0,1)->(2,1)
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    globalConnNetId: "net2",
    dcConnNetId: "dc2",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 2, y: 1.0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pins: [] as any,
  }

  // Trace 2: Horizontal (1,1.02)->(3,1.02) then Vertical (3,1.02)->(3,2.02)
  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    globalConnNetId: "net2",
    dcConnNetId: "dc2",
    tracePath: [
      { x: 1, y: 1.02 },
      { x: 3, y: 1.02 },
      { x: 3, y: 2.02 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pins: [] as any,
  }

  // Run the combine solver
  const result = TraceCombineSolver.tryCombineParallelTraces(
    [trace1, trace2],
    0.05,
  )

  // Trace 1 should be adjusted: (0,0) -> (0,1.01) -> (2,1.01)
  expect(result[0].tracePath[0].x).toBe(0)
  expect(result[0].tracePath[0].y).toBe(0)
  expect(result[0].tracePath[1].x).toBe(0)
  expect(result[0].tracePath[1].y).toBeCloseTo(1.01, 5)
  expect(result[0].tracePath[2].x).toBe(2)
  expect(result[0].tracePath[2].y).toBeCloseTo(1.01, 5)

  // Trace 2 should be adjusted: (1,1.01) -> (3,1.01) -> (3,2.02)
  expect(result[1].tracePath[0].x).toBe(1)
  expect(result[1].tracePath[0].y).toBeCloseTo(1.01, 5)
  expect(result[1].tracePath[1].x).toBe(3)
  expect(result[1].tracePath[1].y).toBeCloseTo(1.01, 5)
  expect(result[1].tracePath[2].x).toBe(3)
  expect(result[1].tracePath[2].y).toBeCloseTo(2.02, 5)
})
