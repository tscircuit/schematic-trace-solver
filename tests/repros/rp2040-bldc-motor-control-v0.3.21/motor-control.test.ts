import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./motor-control.input.json"
import "tests/fixtures/matcher"

// Captured from the published v0.3.21 motor_control sheet, before trace routing.
// This snapshots the current behavior; it does not claim to fix the reported
// readability/style issues. See README.md for provenance and reproduction steps.
test("RP2040 BLDC controller v0.3.21 motor_control sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(inputProblem) as unknown as InputProblem,
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(
    solver.netLabelToTraceSolver!.getOutput().traces.length,
  ).toBeGreaterThan(0)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
