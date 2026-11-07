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
  expect(leftmostV3v3Trace.tracePath).toHaveLength(3)
  expect(leftmostV3v3Trace.tracePath.at(-1)!.y).toBeCloseTo(-2.365)

  const leftGndReturn =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
      (trace) => trace.mspPairId === "schematic_port_32-schematic_port_12",
    )!
  const rightGndReturn =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
      (trace) => trace.mspPairId === "schematic_port_31-schematic_port_24",
    )!
  expect(rightGndReturn.tracePath[2]!.x).toBeCloseTo(
    leftGndReturn.tracePath[2]!.x,
    6,
  )
  expect(rightGndReturn.tracePath[3]!.x).toBeCloseTo(
    leftGndReturn.tracePath[3]!.x,
    6,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
