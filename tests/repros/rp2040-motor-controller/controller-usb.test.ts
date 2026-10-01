import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/controller-usb.input.json"

// v1.0.40, sheet controller_programming, section MCU__usb.
// Components: J_USB, R_CC1, R_CC2, R_USB1, R_USB2.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: controller-usb", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
