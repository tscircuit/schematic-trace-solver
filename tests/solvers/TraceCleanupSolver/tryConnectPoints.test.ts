import { test, expect } from "bun:test"
import { tryConnectPoints } from "lib/solvers/TraceCleanupSolver/tryConnectPoints"

test("tryConnectPoints returns direct for aligned points", () => {
  const start = { x: 0, y: 0 }
  const end = { x: 0, y: 10 }
  const result = tryConnectPoints(start, end)
  expect(result).toEqual([
    [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ],
  ])
})

test("tryConnectPoints returns two candidates for offset points", () => {
  const start = { x: 0, y: 0 }
  const end = { x: 10, y: 10 }
  const result = tryConnectPoints(start, end)
  expect(result.length).toBe(2)
  expect(result[0]).toEqual([start, { x: 10, y: 0 }, end])
  expect(result[1]).toEqual([start, { x: 0, y: 10 }, end])
})
