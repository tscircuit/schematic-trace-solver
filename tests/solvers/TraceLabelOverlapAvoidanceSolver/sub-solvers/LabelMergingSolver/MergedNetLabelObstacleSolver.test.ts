import { test, expect } from "bun:test"

test("MergedNetLabelObstacleSolver exports class", async () => {
  const module = await import(
    "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver"
  )
  expect(typeof module.MergedNetLabelObstacleSolver).toBe("function")
})
