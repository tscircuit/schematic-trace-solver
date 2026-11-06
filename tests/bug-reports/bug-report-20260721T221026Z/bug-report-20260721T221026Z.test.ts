import { expect, test } from "bun:test"
import {
  rectsOverlap,
  traceCrossesBoundsInterior,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260721T221026Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260721T221026Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const junctionOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const alignedTrace = junctionOutput.traces.find(
    (trace) => trace.mspPairId === "R_RUN.1-C_MCU1.1",
  )!
  const attachedLabel = junctionOutput.netLabelPlacements.find((label) =>
    label.mspConnectionPairIds.includes(alignedTrace.mspPairId),
  )!
  expect(
    tracePathContainsPoint(alignedTrace.tracePath, attachedLabel.anchorPoint),
  ).toBe(true)

  const output = solver.netLabelToTraceSolver!.getOutput()
  const v1v1Label = output.netLabelPlacements.find(
    (label) => label.netId === "V1V1" && label.pinIds.includes("U_MCU.50"),
  )!
  const v1v1Bounds = getRectBounds(
    v1v1Label.center,
    v1v1Label.width,
    v1v1Label.height,
  )
  for (const portNetId of ["QD3", "QCLK"]) {
    const portLabel = output.netLabelPlacements.find(
      (label) => label.netId === portNetId,
    )!
    expect(
      rectsOverlap(
        v1v1Bounds,
        getRectBounds(portLabel.center, portLabel.width, portLabel.height),
      ),
    ).toBe(false)
  }

  const v3v3Label = output.netLabelPlacements.find(
    (label) => label.netId === "V3V3" && label.pinIds.includes("U_MCU.42"),
  )!
  const traceMap = Object.fromEntries(
    output.traces.map((trace) => [trace.mspPairId, trace]),
  )
  expect(
    traceCrossesBoundsInterior(
      getRectBounds(v3v3Label.center, v3v3Label.width, v3v3Label.height),
      traceMap,
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
