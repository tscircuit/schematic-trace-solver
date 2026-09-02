import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-powerbank-3v-system-power.input.json"

// Exact solver input captured from the "3 V System Power" sheet in the
// PowerBank example circuit from @tsci/tscircuit.ti.
test("repro PowerBank 3 V System Power schematic", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
