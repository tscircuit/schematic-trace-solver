import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-bq40z60-current-sense.input.json"

// Exact solver input captured while rendering @tsci/tscircuit.ti's
// BatteryManagement_2to4Cell_BQ40Z60 subcircuit. The regression is visible in
// the R38/R43/R44 and C26/C36 current-sense section.
test("repro BQ40Z60 current-sense schematic traces", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
