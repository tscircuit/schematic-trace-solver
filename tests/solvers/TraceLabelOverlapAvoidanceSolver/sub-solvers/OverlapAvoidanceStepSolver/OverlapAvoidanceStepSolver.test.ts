import { test, expect } from "bun:test"

test("OverlapAvoidanceStepSolver exports class", async () => {
  const module = await import(
    "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/OverlapAvoidanceStepSolver/OverlapAvoidanceStepSolver"
  )
  expect(typeof module.OverlapAvoidanceStepSolver).toBe("function")
})
