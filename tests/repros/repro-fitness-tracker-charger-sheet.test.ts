import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/repro-fitness-tracker-charger-sheet.input.json"
import "tests/fixtures/matcher"

// Exact solver:started payload from @tscircuit/core 0.0.2196, charger sheet.
// Captured before core's custom-symbol rotation fix: D2's pins arrive vertical.
// Custom symbol paths are absent from InputProblem, so this snapshot covers
// routing only. The symbol/port mismatch needs a core regression test.
test("repro fitness tracker charger sheet", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
