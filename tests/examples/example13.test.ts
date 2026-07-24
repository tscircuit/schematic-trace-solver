import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example13.json"
import "tests/fixtures/matcher"

test("example13", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver.schematicTraceLinesSolver?.solvedTracePaths.some(
      (trace) =>
        trace.mspPairId === "PWR1.1-C7.1" || trace.mspPairId === "PWR1.4-C6.1",
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
