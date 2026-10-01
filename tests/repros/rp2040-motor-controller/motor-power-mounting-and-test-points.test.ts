import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/motor-power-mounting-and-test-points.input.json"

// v1.0.40, sheet motor_power, section (unsectioned).
// Components: MH1, MH2, MH3, MH4, TP_PD, TP_VMOTOR, TP_PD_GND.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: motor-power-mounting-and-test-points", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
