import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-zero-crystal-fallback-netlabels.input.json"

test("rp2040-zero crystal connection drops one branch", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.schematicTraceLinesSolver?.solvedTracePaths).toHaveLength(1)
  expect(solver.schematicTraceLinesSolver?.failedConnectionPairs).toHaveLength(
    1,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
