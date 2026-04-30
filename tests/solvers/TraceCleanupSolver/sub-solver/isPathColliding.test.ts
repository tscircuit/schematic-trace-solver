import { test, expect } from "bun:test"
import {
  isPathColliding,
  type CollisionInfo,
} from "lib/solvers/TraceCleanupSolver/sub-solver/isPathColliding"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("isPathColliding returns false for empty path", () => {
  const result: CollisionInfo = isPathColliding([], [])
  expect(result.isColliding).toBe(false)
})

test("isPathColliding returns false for path with single point", () => {
  const result: CollisionInfo = isPathColliding([{ x: 0, y: 0 }], [])
  expect(result.isColliding).toBe(false)
})

test("isPathColliding returns false when no traces provided", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  const result: CollisionInfo = isPathColliding(path, [])
  expect(result.isColliding).toBe(false)
})

test("isPathColliding returns false for non-overlapping traces", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 10, y: 10 },
      { x: 11, y: 11 },
    ],
  } as any

  const result: CollisionInfo = isPathColliding(path, [trace])
  expect(result.isColliding).toBe(false)
})

test("isPathColliding excludes specified trace", () => {
  // Path that would collide but is excluded by traceIdToExclude
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ], // Same path - would collide
  } as any

  const result: CollisionInfo = isPathColliding(path, [trace], "trace1")
  expect(result.isColliding).toBe(false)
})
