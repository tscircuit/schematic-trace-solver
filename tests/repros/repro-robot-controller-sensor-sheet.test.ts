import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-robot-controller-sensor-sheet.input.json"

// Captured from the ROVER robot controller's Sensors sheet using
// @tscircuit/core 0.0.1861 (tscircuit 0.0.2467). This is the unchanged
// solver:started input after automatic placement: IMU/ToF, microSD and CAN.
// Keep all three sections together to preserve the reported sheet geometry.
// The companion .source.svg is the original core-rendered schematic. Its
// symbol and power-label metadata is not all included in the solver input.
test("repro robot controller sensor sheet trace routing", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
