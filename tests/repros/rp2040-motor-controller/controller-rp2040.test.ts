import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/controller-rp2040.input.json"

// v1.0.40, sheet controller, section MCU__rp2040.
// Components: C_IOVDD1, C_IOVDD2, C_IOVDD3, C_IOVDD4, C_IOVDD5, C_IOVDD6, U1, C_CORE, C_DVDD1, C_DVDD2.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: controller-rp2040", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
