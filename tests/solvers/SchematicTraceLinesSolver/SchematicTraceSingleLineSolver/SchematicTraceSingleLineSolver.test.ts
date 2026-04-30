import { test, expect } from "bun:test"

test("SchematicTraceSingleLineSolver exports class", async () => {
  const module = await import(
    "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
  )
  expect(typeof module.SchematicTraceSingleLineSolver).toBe("function")
})
