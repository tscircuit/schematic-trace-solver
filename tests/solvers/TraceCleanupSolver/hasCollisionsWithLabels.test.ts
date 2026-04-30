import { test, expect } from "bun:test"
import { hasCollisionsWithLabels } from "lib/solvers/TraceCleanupSolver/hasCollisionsWithLabels"

test("hasCollisionsWithLabels returns false for empty path", () => {
  const path = [{ x: 0, y: 0 }]
  const labels = [{ minX: 5, maxX: 10, minY: 5, maxY: 10 }] as any
  expect(hasCollisionsWithLabels(path, labels)).toBe(false)
})

test("hasCollisionsWithLabels returns false for no labels", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]
  expect(hasCollisionsWithLabels(path, [])).toBe(false)
})

test("hasCollisionsWithLabels returns false when no collision", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ]
  const labels = [{ minX: 5, maxX: 10, minY: 0, maxY: 1 }] as any
  expect(hasCollisionsWithLabels(path, labels)).toBe(false)
})
