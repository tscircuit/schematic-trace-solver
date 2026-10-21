import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/gimbal-one-sheet-power.input.json"

// Exact sheet_Power input captured from the auto-layout Gimbal One controller.
test("gimbal one power sheet trace routing", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: false,
    },
  )
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
