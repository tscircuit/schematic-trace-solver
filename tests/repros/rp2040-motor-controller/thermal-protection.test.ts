import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/thermal-protection.input.json"

// v1.0.40, sheet thermal_protection, section thermal_protection.
// Components: U_TEMP, C_TEMP, R_TEMP_SDA, R_TEMP_SCL, R_MCU_ENABLE_PD.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: thermal-protection", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
