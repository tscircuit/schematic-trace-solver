import { test, expect } from "bun:test"

test("visualizeSingleNetLabelPlacementSolver exports function", async () => {
  const module = await import(
    "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver_visualize"
  )
  expect(typeof module.visualizeSingleNetLabelPlacementSolver).toBe("function")
})
