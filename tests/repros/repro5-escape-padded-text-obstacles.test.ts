import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro5-escape-padded-text-obstacles.input.json"

test("repro5: route cannot escape padded text obstacles", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.map(
      (pair) => pair.mspPairId,
    ),
  ).toEqual(["LED1.2-U1.20"])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
