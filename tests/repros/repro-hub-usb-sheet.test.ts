import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-hub-usb-sheet.input.json"

// Captured from @tsci/mohan-bee.hub 1.0.12 using @tscircuit/core 0.0.1816.
// Only opaque schematic component IDs were replaced with unique source names.
test("repro hub USB sheet schematic trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
