import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260916T054012Z.json"
import "tests/fixtures/matcher"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"

test("bug-report-20260916T054012Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const { outputNetLabelPlacements: labels, outputTraces: traces } =
    solver.netLabelToTraceSolver!
  const ground = labels.find((label) =>
    label.pinIds.includes("schematic_port_115"),
  )!
  expect(ground.pinIds).toContain("schematic_port_117")
  expect(ground.orientation).toBe("y-")
  expect(
    traceCrossesBoundsInterior(
      getRectBounds(ground.center, ground.width, ground.height),
      Object.fromEntries(traces.map((trace) => [trace.mspPairId, trace])),
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("vertical shared-rail placement is not limited to ground nets", () => {
  const nonGroundInput = structuredClone(inputProblem) as any
  const renamedConnection = nonGroundInput.netConnections.find(
    (connection: any) => connection.netId === "GND",
  )
  renamedConnection.netId = "VREF"
  renamedConnection.netLabelText = "VREF"
  renamedConnection.isGround = false
  nonGroundInput.availableNetLabelOrientations.VREF =
    nonGroundInput.availableNetLabelOrientations.GND
  delete nonGroundInput.availableNetLabelOrientations.GND

  const solver = new SchematicTracePipelineSolver(nonGroundInput)
  solver.solve()

  const { outputNetLabelPlacements: labels, outputTraces: traces } =
    solver.netLabelToTraceSolver!
  const vref = labels.find((label) =>
    label.pinIds.includes("schematic_port_115"),
  )!
  const hostTrace = traces.find(
    (trace) => trace.mspPairId === "schematic_port_117-schematic_port_115",
  )!
  const connector = traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-15-VREF",
  )!

  expect(vref.netId).toBe("VREF")
  expect(vref.orientation).toBe("y-")
  expect(connector.tracePath).toEqual([
    { x: vref.anchorPoint.x, y: -8.2 },
    vref.anchorPoint,
  ])
  expect(
    tracePathContainsPoint(hostTrace.tracePath, connector.tracePath[0]!),
  ).toBe(true)
  expect(
    traceCrossesBoundsInterior(
      getRectBounds(vref.center, vref.width, vref.height),
      Object.fromEntries(traces.map((trace) => [trace.mspPairId, trace])),
    ),
  ).toBe(false)
})
