import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-bc107a-common-emitter-routing.input.json"

// Exact solver input captured from @tscircuit/core while rendering a BC107A
// common-emitter amplifier with input/output coupling capacitors and bias rails.
test("repro bc107a common emitter routing", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
