import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-bldc-battery-v0.3.21.input.json"

// Full battery sheet from MustafaMulla29/rp2040-bldc-motor-controller-new v0.3.21.
// Unmodified input captured with the release’s locked core/solver versions.
test("RP2040 BLDC controller v0.3.21 battery sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(inputProblem) as InputProblem,
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(
    solver.netLabelToTraceSolver!.getOutput().traces.length,
  ).toBeGreaterThan(0)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
