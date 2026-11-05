import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/gimbal-pitch-sheet.input.json"
import "tests/fixtures/matcher"

// Exact solver:started input captured from @tscircuit/core 0.0.2174 for
// Gimbal One's sheet_PITCH, before the trace solver runs. Includes U_PITCH
// (DRV8313), J_PITCH, C19–C24, and R9–R11 with their generated placement.
test("Gimbal One sheet_PITCH", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: false,
    },
  )
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
