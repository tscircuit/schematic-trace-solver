import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro47-endpoint-obstacle-detour.input.json"

test("repro47: endpoint obstacle detours fall back to net labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver
      .schematicTraceLinesSolver!.failedConnectionPairs.map(
        (pair) => pair.mspPairId,
      )
      .sort(),
  ).toEqual(["J1.1-R1.1", "J1.3-R1.2"])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
