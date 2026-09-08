import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-robot-controller-imu-tof.input.json"

// IMU/ToF section from ROVER, captured with @tscircuit/core 0.0.1861.
// Other sections are removed; retained placement and routing options are unchanged.
test("repro robot controller IMU and ToF trace routing", async () => {
  expect([
    ...new Set(inputProblem.chips.map((chip) => chip.sectionId)),
  ]).toEqual(["07_IMU_AND_TOF"])

  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
