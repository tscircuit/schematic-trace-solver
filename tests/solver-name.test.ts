import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "../lib"

test("SchematicTracePipelineSolver has a stable solver name", () => {
  const solver = Object.create(
    SchematicTracePipelineSolver.prototype,
  ) as SchematicTracePipelineSolver

  expect(solver.getSolverName()).toBe("SchematicTracePipelineSolver")
})
