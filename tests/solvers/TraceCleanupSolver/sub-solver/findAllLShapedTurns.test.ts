import { test, expect } from "bun:test"
import { findAllLShapedTurns } from "lib/solvers/TraceCleanupSolver/sub-solver/findAllLShapedTurns"

test("findAllLShapedTurns returns empty for path with less than 3 points", () => {
  expect(findAllLShapedTurns([])).toHaveLength(0)
  expect(findAllLShapedTurns([{ x: 0, y: 0 }])).toHaveLength(0)
  expect(
    findAllLShapedTurns([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]),
  ).toHaveLength(0)
})

test("findAllLShapedTurns returns empty for straight line", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]
  expect(findAllLShapedTurns(path)).toHaveLength(0)
})

test("findAllLShapedTurns finds L-shaped turns", () => {
  // Path with one L-shaped turn
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 }, // vertical up
    { x: 1, y: 1 }, // horizontal right = L turn at (0, 1)
  ]
  const lShapes = findAllLShapedTurns(path)
  expect(lShapes.length).toBeGreaterThanOrEqual(1)
  expect(lShapes[0]).toMatchObject({
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  })
})

test("findAllLShapedTurns detects corner point correctly", () => {
  // Simple L shape
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]
  const lShapes = findAllLShapedTurns(path)
  expect(lShapes.length).toBe(1)
  expect(lShapes[0]!.p2).toEqual({ x: 0, y: 1 })
})

test("findAllLShapedTurns returns empty for diagonal path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ]
  expect(findAllLShapedTurns(path)).toHaveLength(0)
})
