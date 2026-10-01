import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/encoder.input.json"

// v1.0.40, sheet position_alarm, section encoder.
// Components: U_ENCODER, R_ENC_SDA, R_ENC_SCL.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: encoder", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
