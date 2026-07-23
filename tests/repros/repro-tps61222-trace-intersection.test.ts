import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tps61222-trace-intersection.input.json"

// Extracted from https://github.com/tscircuit/core/pull/2785 with
// DEBUG=Group_doInitialSchematicTraceRender.
test("repro TPS61222 schematic trace intersection", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
