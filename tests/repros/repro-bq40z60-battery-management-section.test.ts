import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-bq40z60-battery-management-section.input.json"
import "tests/fixtures/matcher"

// InputProblem captured with @tscircuit/core 0.0.1752 from tscircuit/ti main
// (fe7c16f) for the BQ40Z60 section containing U2, C18, C20, C27, and RT1-RT4.
test("repro bq40z60 battery management section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
