import { test, expect } from "bun:test"
import { isPointInsideLabel } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/OverlapAvoidanceStepSolver/isPointInsideLabel"

test("isPointInsideLabel returns true for point inside bounds", () => {
  const point = { x: 5, y: 5 }
  const label = {
    center: { x: 5, y: 5 },
    width: 1,
    height: 1,
  } as any

  const result = isPointInsideLabel({ point, label })
  expect(result).toBe(true)
})

test("isPointInsideLabel returns false for point outside bounds", () => {
  const point = { x: 100, y: 100 }
  const label = {
    center: { x: 5, y: 5 },
    width: 1,
    height: 1,
  } as any

  const result = isPointInsideLabel({ point, label })
  expect(result).toBe(false)
})

test("isPointInsideLabel returns true for point on edge", () => {
  const point = { x: 4.5, y: 5 } // left edge
  const label = {
    center: { x: 5, y: 5 },
    width: 1,
    height: 1,
  } as any

  const result = isPointInsideLabel({ point, label })
  // On edge is considered inside (>= and <=)
  expect(result).toBe(true)
})
