import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-cc3235sf-crystal-collapse.input.json"

// Captured from tscircuit/ti's WirelessMCU_CC3235SF schematic and reduced to
// U2's crystal/GND pins, Y2, and its two load capacitors.
test("repro CC3235SF Y2 crystal traces collapse together", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
