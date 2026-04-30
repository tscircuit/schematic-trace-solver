import { test, expect } from "bun:test"

test("SchematicTraceSingleLineSolver2 exports class", async () => {
  const module = await import(
    "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
  )
  expect(typeof module.SchematicTraceSingleLineSolver2).toBe("function")
})
