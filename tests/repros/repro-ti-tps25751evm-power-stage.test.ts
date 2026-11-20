import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-ti-tps25751evm-power-stage.input.json"

// Captured from the power-stage sheet of the TI TPS25751EVM reference
// schematic (tscircuit/checks tests/reference-schematics) using core 0.0.2430.
test("TI TPS25751EVM power-stage sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
