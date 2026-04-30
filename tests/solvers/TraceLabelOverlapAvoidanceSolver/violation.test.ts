import { test, expect } from "bun:test"
import { findTraceViolationZone } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/violation"

test("findTraceViolationZone returns -1 indices when no violation", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ]
  const labelBounds = { minX: 100, maxX: 200, minY: 100, maxY: 200 }

  const result = findTraceViolationZone(path, labelBounds)

  expect(result.firstInsideIndex).toBe(-1)
  expect(result.lastInsideIndex).toBe(-1)
})

test("findTraceViolationZone finds violation zone", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 5, y: 5 }, // inside
    { x: 10, y: 5 }, // inside
    { x: 15, y: 0 },
  ]
  const labelBounds = { minX: 4, maxX: 12, minY: 4, maxY: 6 }

  const result = findTraceViolationZone(path, labelBounds)

  expect(result.firstInsideIndex).toBe(1)
  expect(result.lastInsideIndex).toBe(2)
})

test("findTraceViolationZone returns -1 for edge-only touch", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 5, y: 0 }, // on edge (x=5, but not inside since strict >)
    { x: 10, y: 0 },
  ]
  const labelBounds = { minX: 5, maxX: 10, minY: 0, maxY: 1 }

  const result = findTraceViolationZone(path, labelBounds)

  // Points on the boundary (minX=5, maxX=10) are not considered inside
  expect(result.firstInsideIndex).toBe(-1)
  expect(result.lastInsideIndex).toBe(-1)
})

test("findTraceViolationZone handles path completely inside", () => {
  const path = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 7, y: 5 },
  ]
  const labelBounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 }

  const result = findTraceViolationZone(path, labelBounds)

  expect(result.firstInsideIndex).toBe(0)
  expect(result.lastInsideIndex).toBe(2)
})
