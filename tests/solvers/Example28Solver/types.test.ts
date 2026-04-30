import { test, expect } from "bun:test"

test("Example28Solver types are exported", async () => {
  const module = await import("lib/solvers/Example28Solver/types")
  expect(typeof module).toBe("object")
})
