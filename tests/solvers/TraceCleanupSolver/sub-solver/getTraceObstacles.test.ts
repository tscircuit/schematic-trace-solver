import { test, expect } from "bun:test"
import {
  getTraceObstacles,
  type TraceObstacle,
} from "lib/solvers/TraceCleanupSolver/sub-solver/getTraceObstacles"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("getTraceObstacles returns empty array when no traces", () => {
  const result = getTraceObstacles([], "trace1")
  expect(result).toHaveLength(0)
})

test("getTraceObstacles excludes specified trace", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    } as any,
    {
      mspPairId: "trace2",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [
        { x: 10, y: 10 },
        { x: 11, y: 11 },
      ],
    } as any,
  ]

  const obstacles = getTraceObstacles(traces, "trace1")
  expect(obstacles).toHaveLength(1)
  expect(obstacles[0]!.points).toEqual([
    { x: 10, y: 10 },
    { x: 11, y: 11 },
  ])
})

test("getTraceObstacles includes all traces when no exclusion", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [{ x: 0, y: 0 }],
    } as any,
    {
      mspPairId: "trace2",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [{ x: 10, y: 10 }],
    } as any,
  ]

  const obstacles = getTraceObstacles(traces, "nonexistent")
  expect(obstacles).toHaveLength(2)
})

test("getTraceObstacles preserves trace path points", () => {
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 },
    ],
  } as any

  const obstacles = getTraceObstacles([trace], "trace2")
  expect(obstacles[0]!.points.length).toBe(3)
  expect(obstacles[0]!.points[0]).toEqual({ x: 0, y: 0 })
})
