import { test, expect } from "bun:test"
import { findTraceViolationZone } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/violation"

test("findTraceViolationZone returns -1 when no points inside", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },
  ]
  const labelBounds = { minX: 10, maxX: 20, minY: 10, maxY: 20 }
  const result = findTraceViolationZone(path, labelBounds)
  expect(result.firstInsideIndex).toBe(-1)
  expect(result.lastInsideIndex).toBe(-1)
})

test("findTraceViolationZone finds points inside label bounds", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 15, y: 15 }, // inside
    { x: 18, y: 15 }, // inside
    { x: 50, y: 50 },
  ]
  const labelBounds = { minX: 10, maxX: 20, minY: 10, maxY: 20 }
  const result = findTraceViolationZone(path, labelBounds)
  expect(result.firstInsideIndex).toBe(1)
  expect(result.lastInsideIndex).toBe(2)
})
