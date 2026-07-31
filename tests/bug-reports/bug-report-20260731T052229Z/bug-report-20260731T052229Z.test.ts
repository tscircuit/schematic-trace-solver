import { expect, test } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260731T052229Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260731T052229Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const vdddLabel = output.netLabelPlacements.find(
    (placement) => placement.netId === "VDDD",
  )!
  const vdddBounds = getRectBounds(
    vdddLabel.center,
    vdddLabel.width,
    vdddLabel.height,
  )
  const intersectingDifferentNetTraceIds = output.traces
    .filter((trace) => trace.globalConnNetId !== vdddLabel.globalConnNetId)
    .filter((trace) =>
      trace.tracePath.some(
        (point, index) =>
          index < trace.tracePath.length - 1 &&
          segmentIntersectsRect(point, trace.tracePath[index + 1]!, vdddBounds),
      ),
    )
    .map((trace) => trace.mspPairId)

  expect(vdddLabel.orientation).toBe("y+")
  expect(intersectingDifferentNetTraceIds).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
