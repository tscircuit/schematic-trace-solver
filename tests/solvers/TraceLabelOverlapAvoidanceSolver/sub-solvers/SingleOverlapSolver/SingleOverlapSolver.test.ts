import { test, expect } from "bun:test"

test("SingleOverlapSolver exports class", async () => {
  const module = await import(
    "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
  )
  expect(typeof module.SingleOverlapSolver).toBe("function")
})
