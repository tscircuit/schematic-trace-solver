import { test, expect } from "bun:test"

test("SingleNetLabelPlacementSolver host module exports", async () => {
  const module = await import(
    "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/host"
  )
  expect(typeof module).toBe("object")
})
