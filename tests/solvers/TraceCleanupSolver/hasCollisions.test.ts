import { test, expect } from "bun:test"
import { hasCollisions } from "lib/solvers/TraceCleanupSolver/hasCollisions"

test("hasCollisions returns false for empty path", () => {
  const path = [{ x: 0, y: 0 }]
  const obstacles = [{ minX: 5, maxX: 10, minY: 5, maxY: 10 }]
  expect(hasCollisions(path, obstacles)).toBe(false)
})

test("hasCollisions returns false for single point path", () => {
  const path = [{ x: 0, y: 0 }]
  const obstacles = [{ minX: 0, maxX: 1, minY: 0, maxY: 1 }]
  expect(hasCollisions(path, obstacles)).toBe(false)
})

test("hasCollisions returns false when no obstacles", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ]
  const obstacles: any[] = []
  expect(hasCollisions(path, obstacles)).toBe(false)
})

test("hasCollisions returns false for path not touching obstacles", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ]
  const obstacles = [{ minX: 5, maxX: 10, minY: 0, maxY: 1 }]
  expect(hasCollisions(path, obstacles)).toBe(false)
})
