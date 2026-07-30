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
  const vddLabel = solver
    .sameNetJunctionAlignmentSolver!.getOutput()
    .netLabelPlacements.find(
      (label) => label.globalConnNetId === vddBranch.globalConnNetId,
    )!

  expect(vddBranch.tracePath).toContainEqual({
    x: -2.5700000000000003,
    y: 0.6999999999999998,
  })
  expect(vddLabel.anchorPoint).toEqual({
    x: vddBranch.pins[1]!.x,
    y: vddBranch.pins[1]!.y,
  })
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
