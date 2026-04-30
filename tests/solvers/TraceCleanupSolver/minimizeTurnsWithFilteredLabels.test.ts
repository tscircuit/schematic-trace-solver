import { test, expect } from "bun:test"

test("minimizeTurnsWithFilteredLabels exports function", async () => {
  const module = await import(
    "lib/solvers/TraceCleanupSolver/minimizeTurnsWithFilteredLabels"
  )
  expect(typeof module.minimizeTurnsWithFilteredLabels).toBe("function")
})
