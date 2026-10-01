import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/motor-driver-core.input.json"

// v1.0.40, sheet motor_driver, section motor_driver_core.
// Components: DRIVER, C_CP, C_VCP, R_VCP, C_VMA, C_DRV_3V3, R_DRV_REF_TOP, R_DRV_REF_BOTTOM, C_DRV_REF, R_DRV_ENABLE_PU, C_VM_BULK, C_VM_HF, R_ISEN_A, R_ISEN_B, R_SLEEP_PD, R_FAULT_PU, Q_PD_ENABLE, R_PD_ENABLE_PU.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: motor-driver-core", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
