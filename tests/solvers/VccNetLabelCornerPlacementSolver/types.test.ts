import { test, expect } from "bun:test"

test("VccNetLabelCornerPlacementSolver types are exported", async () => {
  const module = await import(
    "lib/solvers/VccNetLabelCornerPlacementSolver/types"
  )
  expect(typeof module).toBe("object")
})
