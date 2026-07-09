import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro148-missing-trace-netlabel.input.json"
import "tests/fixtures/matcher"

// Regression (from @tscircuit/core repro148): the RESET connection between R3 and
// SW2 used to route as a trace but now falls back to two net labels.
test("repro148 missing trace becomes net labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
