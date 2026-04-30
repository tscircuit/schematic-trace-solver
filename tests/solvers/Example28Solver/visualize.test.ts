import { test, expect } from "bun:test"

test("Example28Solver visualize module exports functions", async () => {
  const module = await import("lib/solvers/Example28Solver/visualize")
  expect(typeof module.visualizeExample28Solver).toBe("function")
})
