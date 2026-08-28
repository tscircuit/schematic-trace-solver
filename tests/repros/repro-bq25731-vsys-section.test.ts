import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-bq25731-vsys-section.input.json"

// Minimal input derived from @tsci/tscircuit.ti's
// BatteryCharging_2to5CellNVDCBuckBoost_BQ25731 subcircuit. It isolates Q2 and
// the C3/C55/C56 VSYS capacitor bank.
test("repro BQ25731 VSYS buck-boost section", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
