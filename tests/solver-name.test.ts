import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "../lib"

test("SchematicTracePipelineSolver has a stable solver name", () => {
  expect(SchematicTracePipelineSolver.solverName).toBe(
    "SchematicTracePipelineSolver",
  )
})
