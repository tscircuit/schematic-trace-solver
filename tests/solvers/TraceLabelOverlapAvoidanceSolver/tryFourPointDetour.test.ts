import { test, expect } from "bun:test"

test("tryFourPointDetour module exports function", async () => {
  const module = await import(
    "lib/solvers/TraceLabelOverlapAvoidanceSolver/tryFourPointDetour"
  )
  expect(typeof module.generateFourPointDetourCandidates).toBe("function")
})
