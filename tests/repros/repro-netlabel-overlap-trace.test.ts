import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro147-netlabel-overlap-trace.input.json"
import "tests/fixtures/matcher"

// Regression (from @tscircuit/core repro147): a GND net label ends up overlapping
// the B1/SW1 junction trace instead of being placed clear of it.
test("repro147 netlabel overlaps trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
