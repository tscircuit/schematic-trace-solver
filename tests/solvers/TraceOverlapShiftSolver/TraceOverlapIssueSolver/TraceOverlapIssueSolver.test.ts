import { test, expect } from "bun:test"

test("TraceOverlapIssueSolver exports class", async () => {
  const module = await import(
    "lib/solvers/TraceOverlapShiftSolver/TraceOverlapIssueSolver/TraceOverlapIssueSolver"
  )
  expect(typeof module.TraceOverlapIssueSolver).toBe("function")
})
