import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-am3352-sheet3-power-rails.input.json"

// Reduced from the deployed AM3352 board, sheet 3 (03-Interfaces).
// See the companion .md for provenance and reconstruction details.
test("repro AM3352 sheet 3 connector power and ground rails", async () => {
  const problem = structuredClone(input) as InputProblem
  expect(problem.chips.map((chip) => chip.chipId).sort()).toEqual([
    "J_I2C",
    "J_SD",
    "J_SPI",
    "J_USB0",
  ])
  expect(
    problem.netConnections.find((net) => net.netId === "V3V3")?.pinIds,
  ).toEqual(["J_SD.4", "J_SPI.2", "J_I2C.2"])
  expect(
    problem.netConnections.find((net) => net.netId === "GND")?.pinIds,
  ).toHaveLength(16)

  const pinIds = problem.chips.flatMap((chip) =>
    chip.pins.map((pin) => pin.pinId),
  )
  expect(new Set(pinIds).size).toBe(36)
  expect(problem.netConnections.flatMap((net) => net.pinIds).sort()).toEqual(
    pinIds.sort(),
  )
  expect(problem.availableNetLabelOrientations.V3V3).toEqual(["y+"])
  expect(problem.availableNetLabelOrientations.GND).toEqual(["y-"])

  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
