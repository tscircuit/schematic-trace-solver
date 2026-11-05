import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-wireless-mcu-cc3235sf-full.input.json"

// Complete "group-trace-render-input-problem" capture from tscircuit/ti's
// WirelessMCU_CC3235SF, including the full capacitor bank and support circuitry.
test("repro WirelessMCU CC3235SF full schematic trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
