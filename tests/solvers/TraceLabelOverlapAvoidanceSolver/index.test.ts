import { test, expect } from "bun:test"

test("TraceLabelOverlapAvoidanceSolver index exports", async () => {
  const module = await import(
    "lib/solvers/TraceLabelOverlapAvoidanceSolver/index"
  )
  expect(typeof module).toBe("object")
})
