import { test, expect } from "bun:test"

test("correctPinsInsideChips exports function", async () => {
  const module = await import(
    "lib/solvers/SchematicTracePipelineSolver/correctPinsInsideChip"
  )
  expect(typeof module.correctPinsInsideChips).toBe("function")
})
