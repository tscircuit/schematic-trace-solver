import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/rgb.input.json"

// v1.0.40, sheet status_led, section rgb.
// Components: D_STATUS, R_STATUS_R, Q_STATUS_R, R_STATUS_G, Q_STATUS_G, R_STATUS_B, Q_STATUS_B.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: rgb", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
