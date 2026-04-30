import { test, expect } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"

test("segmentIntersectsRect returns false for non-axis-aligned segment", () => {
  const result = segmentIntersectsRect(
    { x: 0, y: 0 },
    { x: 1, y: 1 }, // diagonal
    { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  )
  expect(result).toBe(false)
})

test("segmentIntersectsRect returns true for vertical segment crossing rect", () => {
  const result = segmentIntersectsRect(
    { x: 5, y: 0 },
    { x: 5, y: 10 },
    { minX: 0, minY: 2, maxX: 10, maxY: 8 },
  )
  expect(result).toBe(true)
})

test("segmentIntersectsRect returns true for horizontal segment crossing rect", () => {
  const result = segmentIntersectsRect(
    { x: 0, y: 5 },
    { x: 10, y: 5 },
    { minX: 2, minY: 0, maxX: 8, maxY: 10 },
  )
  expect(result).toBe(true)
})

test("segmentIntersectsRect returns false when vertical segment is outside rect", () => {
  const result = segmentIntersectsRect(
    { x: 100, y: 0 },
    { x: 100, y: 10 },
    { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  )
  expect(result).toBe(false)
})

test("segmentIntersectsRect returns false when horizontal segment is outside rect", () => {
  const result = segmentIntersectsRect(
    { x: 0, y: 100 },
    { x: 10, y: 100 },
    { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  )
  expect(result).toBe(false)
})

test("segmentIntersectsRect returns false when segment only touches edge", () => {
  // Segment that touches but doesn't cross the rect
  const result = segmentIntersectsRect(
    { x: 5, y: 0 },
    { x: 5, y: 2 },
    { minX: 0, minY: 2, maxX: 10, maxY: 8 },
  )
  // The segment touches minY but doesn't cross through the rect interior
  expect(result).toBe(false)
})

test("segmentIntersectsRect uses EPS parameter correctly", () => {
  // Segment very close to vertical
  const result = segmentIntersectsRect(
    { x: 0.0000001, y: 0 },
    { x: 0.0000001, y: 10 },
    { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    1e-6,
  )
  expect(result).toBe(true)
})
