import { expect, test } from "bun:test"
import { LABEL_SEARCH_STEP } from "lib/solvers/AvailableNetOrientationSolver/constants"
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
  const vdddConnector = output.traces.find(
    (trace) =>
      trace.userNetId === "VDDD" &&
      trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  const alignedLabelXs = ["VDDR", "VDDS", "VDDD"].map(
    (netId) =>
      output.netLabelPlacements.find((placement) => placement.netId === netId)!
        .anchorPoint.x,
  )
  const vddioLabel = output.netLabelPlacements.find(
    (placement) => placement.netId === "VDDIO",
  )!
  const vddioBounds = getRectBounds(
    vddioLabel.center,
    vddioLabel.width,
    vddioLabel.height,
  )

  expect(vdddLabel.orientation).toBe("y+")
  expect(new Set(alignedLabelXs)).toHaveLength(1)
  expect(vdddBounds.minX - vddioBounds.maxX).toBeGreaterThanOrEqual(
    LABEL_SEARCH_STEP,
  )
  expect(intersectingDifferentNetTraceIds).toEqual([])
  expect(vdddConnector.tracePath).toHaveLength(3)
  expect(vdddConnector.tracePath[0]!.y).toBe(vdddConnector.tracePath[1]!.y)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
