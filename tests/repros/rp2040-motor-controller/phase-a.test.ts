import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/phase-a.input.json"

// v1.0.40, sheet current_telemetry, section phase_A.
// Components: R_PHASE_A, U_CURRENT_A, R_ADC_A, C_ADC_A.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: phase-a", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
