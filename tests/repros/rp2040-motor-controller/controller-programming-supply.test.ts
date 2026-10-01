import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/controller-programming-supply.input.json"

// v1.0.40, sheet controller_programming, section MCU__programming_supply.
// Components: D_VBUS, R_3V3_EN, U3, C_VBUS.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: controller-programming-supply", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
