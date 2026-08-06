import { expect, test } from "bun:test"
import { tracePathIntersectsBounds } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260804T225912Z.json"
import "tests/fixtures/matcher"

const EXPECTED_CHIP_TO_CAPACITOR_MAX_Y = 0.58

test("bug-report-20260804T225912Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const gndLabel = output.netLabelPlacements.find(
    (label) => label.netId === "GND",
  )!
  const gndTrace = output.traces.find(
    (trace) => trace.globalConnNetId === gndLabel.globalConnNetId,
  )!

  expect(gndLabel.center).toEqual({ x: -3.79, y: -0.8 })
  expect(
    tracePathIntersectsBounds(
      gndTrace.tracePath,
      getRectBounds(gndLabel.center, gndLabel.width, gndLabel.height),
    ),
  ).toBe(false)

  const chipToCapacitorTrace = solver.traceCleanupSolver
    ?.getOutput()
    .traces.find(
      (trace) =>
        trace.pinIds.includes("schematic_port_4") &&
        trace.pinIds.includes("schematic_port_2"),
    )
  expect(chipToCapacitorTrace).toBeDefined()
  if (!chipToCapacitorTrace)
    throw new Error("Chip-to-capacitor trace not found")

  const maxTraceY = Math.max(
    ...chipToCapacitorTrace.tracePath.map((point) => point.y),
  )

  expect(maxTraceY).toBeCloseTo(EXPECTED_CHIP_TO_CAPACITOR_MAX_Y)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
