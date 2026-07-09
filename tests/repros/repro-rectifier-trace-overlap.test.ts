import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro149-rectifier-trace-overlap.input.json"
import "tests/fixtures/matcher"

// Regression (from @tscircuit/core half-bridge-rectifier): the R1->C1 connection
// used to be a simple direct trace but now detours and overlaps another trace.
test("repro149 rectifier trace overlap", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
