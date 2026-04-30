import { test, expect } from "bun:test"

test("AvailableNetOrientationSolver types are exported", async () => {
  const module = await import("lib/solvers/AvailableNetOrientationSolver/types")
  expect(typeof module).toBe("object")
})
