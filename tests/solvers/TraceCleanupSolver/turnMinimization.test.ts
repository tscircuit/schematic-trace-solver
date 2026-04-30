import { test, expect } from "bun:test"

test("turnMinimization exports function", async () => {
  const module = await import("lib/solvers/TraceCleanupSolver/turnMinimization")
  expect(typeof module.minimizeTurns).toBe("function")
})
