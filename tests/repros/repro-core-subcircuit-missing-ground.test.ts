import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-core-subcircuit-missing-ground.input.json"

// Captured from @tscircuit/core main repro154: two crossed connections enter
// the solver, but only the VOUT_3V3-to-3V3 connection is routed.
test("core repro154 omits one of two crossed subcircuit connections", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
