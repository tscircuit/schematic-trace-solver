import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-cc2340r5.input.json"
import "tests/fixtures/matcher"

test("repro cc2340r5 VDDS trace overlaps its own net label", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
