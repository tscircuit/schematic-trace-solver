import { expect, test } from "bun:test"
import { pathIntersectsAnyNetLabel } from "lib/solvers/SameNetJunctionAlignmentSolver/pathIntersectsAnyNetLabel"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260730T061837Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260730T061837Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traces = solver.sameNetJunctionAlignmentSolver!.getOutput().traces
  const vddBranch = traces.find(
    (trace) => trace.mspPairId === "schematic_port_39-schematic_port_34",
  )!
  const vbusBranch = traces.find(
    (trace) => trace.mspPairId === "schematic_port_31-schematic_port_29",
  )!
  const upstreamVddBranch = traces.find(
    (trace) => trace.mspPairId === "schematic_port_5-schematic_port_39",
  )!

  const upstreamFromShared =
    upstreamVddBranch.pins[0]!.pinId === "schematic_port_39"
      ? upstreamVddBranch.tracePath
      : [...upstreamVddBranch.tracePath].reverse()
  expect(vddBranch.tracePath[1]!.x).toBeCloseTo(upstreamFromShared[1]!.x, 6)
  expect(
    pathIntersectsAnyNetLabel({
      path: vddBranch.tracePath,
      netLabelPlacements:
        solver.sameNetJunctionAlignmentSolver!.getOutput().netLabelPlacements,
    }),
  ).toBe(false)
  expect(vbusBranch.tracePath[1]!.y).toBeCloseTo(0.9)
  expect(vbusBranch.tracePath[2]!.y).toBeCloseTo(0.9)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
