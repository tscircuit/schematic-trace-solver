import { test, expect } from "bun:test"

test("solveNetLabelPlacementForPortOnlyPin exports function", async () => {
  const module = await import(
    "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/solvePortOnlyPin"
  )
  expect(typeof module.solveNetLabelPlacementForPortOnlyPin).toBe("function")
})
