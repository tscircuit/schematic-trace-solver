import { test, expect } from "bun:test"

test("expandChipsToFitPins exports function", async () => {
  const module = await import(
    "lib/solvers/SchematicTracePipelineSolver/expandChipsToFitPins"
  )
  expect(typeof module.expandChipsToFitPins).toBe("function")
})
