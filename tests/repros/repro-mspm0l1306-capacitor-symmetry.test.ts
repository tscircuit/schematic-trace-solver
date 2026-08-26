import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-mspm0l1306-capacitor-symmetry.input.json"

// Captured from tscircuit/ti#119, Microcontroller_MSPM0L1306 at b5ee159.
// Only opaque component/port IDs and display metadata were normalized.
// C1/C2 are already level; their VDD/VSS rail junctions should be level too.
test("repro: MSPM0L1306 aligned decoupling capacitor rails", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
