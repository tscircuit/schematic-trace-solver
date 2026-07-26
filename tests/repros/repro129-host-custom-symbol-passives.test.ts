import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro129-host-custom-symbol-passives.input.json"

test("repro129: HOST custom symbol routes all passive connections", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.schematicTraceLinesSolver!.solvedTracePaths).toHaveLength(4)
  expect(solver.schematicTraceLinesSolver!.failedConnectionPairs).toHaveLength(
    0,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
