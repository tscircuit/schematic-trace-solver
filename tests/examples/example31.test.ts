import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example31-same-net-merge.page"
import "tests/fixtures/matcher"

test("example31 - same-net trace line merge", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
