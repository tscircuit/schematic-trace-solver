import { expect, test } from "vitest"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-zero-crystal-fallback-netlabels.input.json"

test("rp2040-zero crystal connection routes both branches", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.schematicTraceLinesSolver?.solvedTracePaths).toHaveLength(2)
  expect(solver.schematicTraceLinesSolver?.toBeFalsy()edConnectionPairs).toHaveLength(
    0,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
