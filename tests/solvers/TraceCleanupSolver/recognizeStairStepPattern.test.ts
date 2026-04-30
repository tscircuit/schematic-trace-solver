import { test, expect } from "bun:test"
import { recognizeStairStepPattern } from "lib/solvers/TraceCleanupSolver/recognizeStairStepPattern"

test("recognizeStairStepPattern returns -1 for short path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]
  expect(recognizeStairStepPattern(path, 0)).toBe(-1)
})

test("recognizeStairStepPattern returns index for stair-step", () => {
  // This path: horizontal, vertical, horizontal = stair step pattern
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 20, y: 5 },
  ]
  expect(recognizeStairStepPattern(path, 0)).toBeGreaterThanOrEqual(0)
})
