import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-esp32-c3-tft-label-overlap.input.json"

// Captured from the ESP32-C3 TFT carrier's @tscircuit/core solver input.
// The net label text matches the original schematic so the overlap is visible.
test("repro ESP32-C3 TFT header V3V3 and GND label overlap", async () => {
  const solver = new SchematicTracePipelineSolver(input as InputProblem)
  solver.solve()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
