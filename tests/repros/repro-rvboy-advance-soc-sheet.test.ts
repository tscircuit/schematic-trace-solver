import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rvboy-advance-soc-sheet.input.json"

// Complete soc sheet from seveibar/rvboy-advance 0.8.0.
// Release bb3effb5-7b41-4bc0-8c89-65c8c332d25f, captured before solver normalization
// with core 0.0.2277 at 60519165a2315fc7258d5612fd64ac7459af951d.
// The fixture preserves the full input without filtering or changing its geometry.
test("rvboy advance complete SOC sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()

  // Core uses source net names as netId. Supply display text only after routing
  // so snapshot labels are readable without affecting any solver decisions.
  for (const connection of solver.inputProblem.netConnections) {
    connection.netLabelText = connection.netId
  }

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
