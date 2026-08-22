import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260728T144234Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260728T144234Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const leftmostV3v3Trace =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
      (trace) => trace.mspPairId === "schematic_port_34-schematic_port_33",
    )!
  expect(leftmostV3v3Trace.tracePath[1]!.y).toBeCloseTo(-2.365)
  expect(leftmostV3v3Trace.tracePath[2]!.y).toBeCloseTo(-2.365)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
