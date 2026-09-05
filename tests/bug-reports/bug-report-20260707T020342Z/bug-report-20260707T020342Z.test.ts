import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260707T020342Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T020342Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const d1Branch = solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
    (trace) => trace.mspPairId === "D4.2-D1.1",
  )!
  expect(d1Branch.tracePath.at(-1)!.x).toBeCloseTo(-2.85, 6)
  expect(d1Branch.tracePath.at(-1)!.y).toBeCloseTo(1.1, 6)
  const d3Branch = solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
    (trace) => trace.mspPairId === "R1.1-D3.2",
  )!
  expect(d3Branch.tracePath.at(-1)!.x).toBeCloseTo(0, 6)
  expect(d3Branch.tracePath.at(-1)!.y).toBeCloseTo(1.1, 6)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
