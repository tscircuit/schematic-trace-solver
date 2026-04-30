import { test, expect } from "bun:test"

test("NetLabelPlacementSolver exports class", async () => {
  const module = await import(
    "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
  )
  expect(typeof module.NetLabelPlacementSolver).toBe("function")
})
