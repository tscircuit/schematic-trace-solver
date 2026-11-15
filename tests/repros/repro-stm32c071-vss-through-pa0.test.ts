import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-stm32c071-vss-through-pa0.input.json"
import "tests/fixtures/matcher"

// Regression repro: the VSS trace leaves the decoupling capacitor on the
// lower rail, then turns upward on the MCU pin rail. That vertical segment
// passes through PA0 and the SWD_NRST label anchored at PF2.
test("repro STM32C071 VSS trace through PA0 and SWD_NRST", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
