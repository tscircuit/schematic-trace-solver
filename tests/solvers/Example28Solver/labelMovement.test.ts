import { test, expect } from "bun:test"

test("Example28Solver labelMovement module exports functions", async () => {
  const module = await import("lib/solvers/Example28Solver/labelMovement")
  expect(typeof module.moveAttachedLabelsToReroutedTrace).toBe("function")
})
