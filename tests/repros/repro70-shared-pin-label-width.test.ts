import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro70-shared-pin-label-width.input.json"

test("repro70: shared-pin label width blocks an unrelated route", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.map(
      (pair) => pair.mspPairId,
    ),
  ).toEqual(["C3.1-C1.1"])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
