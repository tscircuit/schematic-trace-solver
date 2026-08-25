import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./bug-report-20260825T233101Z.json"

test("isolated DC power regulator trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
