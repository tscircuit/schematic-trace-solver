import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example19.json"
import "tests/fixtures/matcher"

test("example19", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const padTrace = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === "R1.2-JP5.1")
  expect(padTrace?.tracePath[1]?.x).toBeCloseTo(3.6)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
