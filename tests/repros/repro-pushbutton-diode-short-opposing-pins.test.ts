import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-pushbutton-diode-short-opposing-pins.input.json"
import "tests/fixtures/matcher"

// Captured from @tscircuit/core: a pushbutton and diode with nearby opposing
// pins produce a hooked multi-segment trace in the full schematic pipeline.
test("pushbutton-to-diode short opposing pins produce a hooked trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
