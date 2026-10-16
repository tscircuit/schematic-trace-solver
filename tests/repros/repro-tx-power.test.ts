import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-tx-power.input.json"

// Captured from @tscircuit/core 0.0.2152 for the complete TX_power sheet.
test("repro TX power sheet ground label placement", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(inputProblem.chips).toHaveLength(26)
  expect(inputProblem.chips.flatMap((chip) => chip.pins)).toHaveLength(55)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
