import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/pd-gpio-buffers.input.json"

// v1.0.40, sheet pd_voltage_control, section pd_gpio_buffers.
// Components: Q_PD_CFG1, R_PD_CFG1_PU, Q_PD_CFG2, R_PD_CFG2_PU, Q_PD_CFG3, R_PD_CFG3_PU.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: pd-gpio-buffers", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
