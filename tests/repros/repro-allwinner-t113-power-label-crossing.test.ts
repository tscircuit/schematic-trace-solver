import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-allwinner-t113-power-label-crossing.input.json"

// Captured from @tscircuit/core's
// tests/repros/repro184-allwinner-t113-analog-net-label-crossing.test.tsx.
// Aligning the AVCC–HPVCC rail extends the neighboring LDOA1V8 trace through
// the power label above AVCC. Keep the upper supply pins to preserve routing.
test("reproduces the Allwinner T113 power-label crossing", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
