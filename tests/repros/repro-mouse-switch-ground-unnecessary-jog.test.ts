import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-mouse-switch-ground-unnecessary-jog.input.json"

// Captured from @tscircuit/core 0.0.1829 at commit b761dc8.
// The GND route should use one straight vertical trunk between its terminal
// stubs instead of adding the unnecessary horizontal step near the midpoint.
test("repro unnecessary jog in mouse switch ground trunk", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
