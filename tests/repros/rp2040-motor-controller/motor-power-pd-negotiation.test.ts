import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/motor-power-pd-negotiation.input.json"

// v1.0.40, sheet motor_power, section motor_power_pd_negotiation.
// Components: J_MOTOR_USB, U_PD, C_PD_VDD, R_PD_VDD, R_PD_VBUS.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: motor-power-pd-negotiation", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
