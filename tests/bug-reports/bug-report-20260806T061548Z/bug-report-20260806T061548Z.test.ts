import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260806T061548Z.json"
import "tests/fixtures/matcher"
import { getTraceLabelCollisions } from "tests/fixtures/traceLabelCollisions"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"

test("bug-report-20260806T061548Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const railOutput = solver.railNetLabelCornerPlacementSolver!.getOutput()
  const finalOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const v3v3Label = railOutput.netLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" &&
      label.mspConnectionPairIds.includes(
        "schematic_port_43-schematic_port_41",
      ),
  )!
  const pin45Trace = finalOutput.traces.find(
    (trace) => trace.mspPairId === "schematic_port_49-schematic_port_44",
  )!

  expect(v3v3Label.anchorPoint.x).toBeGreaterThan(2.901)
  for (const otherTrace of finalOutput.traces) {
    if (otherTrace.mspPairId === pin45Trace.mspPairId) continue
    if (otherTrace.globalConnNetId === pin45Trace.globalConnNetId) continue

    expect(
      findPerpendicularPathCrossings(
        pin45Trace.tracePath,
        otherTrace.tracePath,
        { includeTerminalSegments: true },
      ),
    ).toEqual([])
  }
  expect(
    getTraceLabelCollisions(finalOutput.traces, finalOutput.netLabelPlacements),
  ).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
