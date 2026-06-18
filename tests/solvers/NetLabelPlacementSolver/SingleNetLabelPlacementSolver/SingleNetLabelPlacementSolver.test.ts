import { test, expect } from "bun:test"

test("SingleNetLabelPlacementSolver exports class", async () => {
  const module = await import(
    "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"
  )
  expect(typeof module.SingleNetLabelPlacementSolver).toBe("function")
})
