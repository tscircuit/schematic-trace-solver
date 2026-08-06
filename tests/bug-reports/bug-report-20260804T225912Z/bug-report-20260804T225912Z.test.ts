import { expect, test } from "bun:test"
import { tracePathIntersectsBounds } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260804T225912Z.json"
import "tests/fixtures/matcher"

const EXPECTED_CHIP_TO_CAPACITOR_MAX_Y = 0.58
const EXPECTED_NET_LABEL_CLEARANCE = 0.05

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
  expect(gndTrace.tracePath).toContainEqual(gndLabel.anchorPoint)
  expect(
    tracePathIntersectsBounds(
      gndTrace.tracePath,
      getRectBounds(gndLabel.center, gndLabel.width, gndLabel.height),
    ),
  ).toBe(true)

  const directLabel = output.netLabelPlacements.find(
    (label) => label.netId === ".U1 > .pin1 to .C2 > .pin1",
  )!
  const directTrace = output.traces.find((trace) =>
    directLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const directLabelBounds = getRectBounds(
    directLabel.center,
    directLabel.width,
    directLabel.height,
  )
  const longSideSegment = directTrace.tracePath.find((point, index, path) => {
    const nextPoint = path[index + 1]
    return nextPoint && point.x === nextPoint.x && point.y !== nextPoint.y
  })!
  expect(longSideSegment.x).toBeLessThanOrEqual(
    directLabelBounds.minX - EXPECTED_NET_LABEL_CLEARANCE,
  )

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
