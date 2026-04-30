import { test, expect } from "bun:test"

test("balanceZShapes exports function", async () => {
  const module = await import("lib/solvers/TraceCleanupSolver/balanceZShapes")
  expect(typeof module.balanceZShapes).toBe("function")
})
