import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-pinch-detection-power-tps7b69.input.json"

// Exact solver input captured from tscircuit/ti's
// PinchDetectionPower_TPS7B69 at 112956d using @tscircuit/core at 51c17c9.
test("repro PinchDetectionPower TPS7B69 schematic traces", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
