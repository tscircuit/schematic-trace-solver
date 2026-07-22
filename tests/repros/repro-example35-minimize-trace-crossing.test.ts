import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-example35-minimize-trace-crossing.input.json"
import "tests/fixtures/matcher"

test("example35 keeps capacitor-chain zig-zags aligned with same-net branches", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const trace = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.find((candidate) => candidate.mspPairId === "C5.1-C4.2")

  expect(trace?.tracePath).toEqual([
    { x: -4, y: -2.6199999999999997 },
    { x: -4, y: -1.9999999999999996 },
    { x: -3, y: -1.9999999999999996 },
    { x: -3, y: -1.38 },
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
