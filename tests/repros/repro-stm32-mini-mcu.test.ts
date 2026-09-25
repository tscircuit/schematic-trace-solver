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
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
