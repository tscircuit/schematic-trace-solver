import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example13.json"
import "tests/fixtures/matcher"

test("example13", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const finalTraces = solver.traceCleanupSolver2!.getOutput().traces
  const upperV5Branch = finalTraces.find(
    (trace) => trace.mspPairId === "PWR1.1-C7.1",
  )!
  const firstV5Branch = finalTraces.find(
    (trace) => trace.mspPairId === "PWR1.6-C6.1",
  )!
  const secondV5Branch = finalTraces.find(
    (trace) => trace.mspPairId === "PWR1.4-C6.1",
  )!
  expect(firstV5Branch.tracePath[1]!.x).toBe(
    secondV5Branch.tracePath[secondV5Branch.tracePath.length - 2]!.x,
  )
  expect(Math.max(...upperV5Branch.tracePath.map((point) => point.y))).toBe(
    2.075,
  )
  expect(upperV5Branch.tracePath[3]!.x).toBe(1.8)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
