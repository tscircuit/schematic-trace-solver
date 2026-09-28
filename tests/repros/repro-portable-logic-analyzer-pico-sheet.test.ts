import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-portable-logic-analyzer-pico-sheet.input.json"

// Captured before routing from the LA16 Pico sheet in core 43fd7e3.
test("repro portable logic analyzer Pico schematic sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as InputProblem,
  )
  solver.solve()

  expect(input.chips).toHaveLength(1)
  expect(input.chips[0]!.pins).toHaveLength(40)
  expect(input.netConnections).toHaveLength(18)
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
