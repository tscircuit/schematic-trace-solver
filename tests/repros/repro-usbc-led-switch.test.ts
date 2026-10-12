import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-usbc-led-switch.input.json"

// Full pixalynx/usbc-led-switch v0.0.1 schematic, captured before routing
// with @tscircuit/core 0.0.2132. See assets/repro-usbc-led-switch.md for provenance.
test("repro USB-C LED switch schematic", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
