import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example12.json"
import "tests/fixtures/matcher"

test("example12", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const finalTraces = solver.traceCleanupSolver2!.getOutput().traces
  const capacitorBranch = finalTraces.find(
    (trace) => trace.mspPairId === "J1.3-C1.2",
  )!
  const resistorBranch = finalTraces.find(
    (trace) => trace.mspPairId === "R1.2-J1.3",
  )!
  expect(capacitorBranch.tracePath[1]!.x).toBe(resistorBranch.tracePath[1]!.x)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
