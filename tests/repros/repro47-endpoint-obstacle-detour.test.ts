import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro47-endpoint-obstacle-detour.input.json"

test("repro47: endpoint obstacle detours route around nearby components", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver
      .schematicTraceLinesSolver!.failedConnectionPairs.map(
        (pair) => pair.mspPairId,
      )
      .sort(),
  ).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
