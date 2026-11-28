import { expect, test } from "bun:test"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import input from "../../bug-reports/bug-report-20260707T134722Z/bug-report-20260707T134722Z.json"

test("branches a horizontal net label laterally from a short horizontal trace", () => {
  const solver = new SchematicTracePipelineSolver(
    input as unknown as InputProblem,
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const netLabelToTraceSolver = solver.netLabelToTraceSolver
  const availableNetOrientationSolver = solver.availableNetOrientationSolver
  if (!netLabelToTraceSolver || !availableNetOrientationSolver) {
    throw new Error("Expected net label solvers to complete")
  }

  const { traces, netLabelPlacements } = netLabelToTraceSolver.getOutput()
  const batLabel = netLabelPlacements.find((label) => label.netId === "BAT")
  if (!batLabel) {
    throw new Error("Expected BAT net label placement")
  }
  expect(["x-", "x+"]).toContain(batLabel.orientation)

  const batBounds = getRectBounds(
    batLabel.center,
    batLabel.width,
    batLabel.height,
  )
  for (const chip of solver.inputProblem.chips) {
    const chipBounds = getRectBounds(chip.center, chip.width, chip.height)
    expect(rectsOverlap(batBounds, chipBounds)).toBe(false)
  }

  const batTraces = traces.filter(
    (trace) => trace.globalConnNetId === batLabel.globalConnNetId,
  )
  expect(
    batTraces.some((trace) =>
      tracePathContainsPoint(trace.tracePath, batLabel.anchorPoint),
    ),
  ).toBe(true)

  const connectorTrace = batTraces.find((trace) =>
    availableNetOrientationSolver.netLabelConnectorTraceIds.has(
      trace.mspPairId,
    ),
  )
  if (!connectorTrace) {
    throw new Error("Expected BAT connector trace")
  }
  expect(connectorTrace.tracePath).toHaveLength(2)
  const [startPoint, endPoint] = connectorTrace.tracePath
  if (!startPoint || !endPoint) {
    throw new Error("Expected connector trace endpoints")
  }
  expect(startPoint.x).toBeCloseTo(endPoint.x)
})
