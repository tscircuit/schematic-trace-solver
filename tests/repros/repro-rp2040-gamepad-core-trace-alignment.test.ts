import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-gamepad-core-trace-alignment.input.json"

// Captured from core d8d83c891b6f9ee40e6634ec0dbcbe5487fea88a (0.0.1959),
// tests/repros/repro-rp2040-gamepad-trace-alignment.test.tsx, via solver:started.
// This baseline intentionally records the staggered left GND rail.
test("reproduces latest core gamepad ground rail alignment", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
