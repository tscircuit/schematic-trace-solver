import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-stm32-mini-mcu.input.json"

// Reconstructed from the exported MCU sheet; see the fixture's provenance note.
test("repro STM32 mini dev board MCU sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as InputProblem,
  )
  solver.solve()
  const resetTrace = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find(
      (trace) =>
        trace.pins.some((pin) => pin.pinId === "schematic_port_28") &&
        trace.pins.some((pin) => pin.pinId === "schematic_port_60"),
    )!
  // U1.NRST to R2 should have one vertical leg between its terminal elbows.
  expect(resetTrace.tracePath).toHaveLength(5)
  expect(resetTrace.tracePath[1]!.x).toBe(resetTrace.tracePath[2]!.x)
  expect(resetTrace.tracePath[2]!.y).toBe(resetTrace.tracePath[3]!.y)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
