import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/phase-b.input.json"

// v1.0.40, sheet current_telemetry, section phase_B.
// Components: R_PHASE_B, U_CURRENT_B, R_ADC_B, C_ADC_B.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: phase-b", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
