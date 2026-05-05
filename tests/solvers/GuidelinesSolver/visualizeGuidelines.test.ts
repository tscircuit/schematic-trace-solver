import { test, expect } from "bun:test"

test("visualizeGuidelines exports function", async () => {
  const module = await import(
    "lib/solvers/GuidelinesSolver/visualizeGuidelines"
  )
  expect(typeof module.visualizeGuidelines).toBe("function")
})
