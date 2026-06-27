import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro130-bq27441-fuel-gauge.input.json"
import "tests/fixtures/matcher"

test("repro130 net-label-only PGND connection does not create a trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces =
    solver.netLabelTraceCollisionSolver?.getOutput().traces ??
    solver.traceCleanupSolver?.getOutput().traces ??
    []
  const traceThroughC1 = traces.find(
    (trace: any) => trace.mspPairId === "U1.3-C1.2",
  )

  expect(traceThroughC1).toBeUndefined()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
