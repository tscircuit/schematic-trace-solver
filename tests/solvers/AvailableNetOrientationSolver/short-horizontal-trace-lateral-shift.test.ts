import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
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

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const batLabel = netLabelPlacements.find((label) => label.netId === "BAT")!
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
    solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
      trace.mspPairId,
    ),
  )!
  expect(connectorTrace.tracePath).toHaveLength(2)
  expect(connectorTrace.tracePath[0]!.x).toBeCloseTo(
    connectorTrace.tracePath[1]!.x,
  )
})
