import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-mac-hub-host-sheet.input.json"

test("repro mac hub host sheet", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
