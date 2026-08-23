import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./repro-ti-power-input-section.input"

test("repro ti power input section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
