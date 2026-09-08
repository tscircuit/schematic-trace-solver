import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Motor section extracted from dronev3's @tscircuit/core 0.0.1854 solver input.
// Original geometry is preserved; chip IDs use unique source component names.
test("repro dronev3 grouped motor driver trace routing", async () => {
  const inputProblem: InputProblem = await Bun.file(
    new URL(
      "./assets/repro-dronev3-grouped-motor-drivers.input.json",
      import.meta.url,
    ),
  ).json()
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })
  solver.solve()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
