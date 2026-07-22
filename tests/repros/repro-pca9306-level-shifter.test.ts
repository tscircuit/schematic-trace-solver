import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-pca9306-level-shifter.input.json"
import "tests/fixtures/matcher"

test("repro pca9306 level shifter", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
