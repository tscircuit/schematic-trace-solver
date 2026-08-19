import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getMinimumDistanceBetweenTracePaths } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/preservesSameNetTraceJunctions"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./bug-report-20260819T091818Z.json"
import "tests/fixtures/matcher"

test("disconnected netlabel", () => {
  const expectedAlignedRailX = 3.18
  const expectedCloserLabelAnchorX = 3.71
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const targetLabel = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_204"),
  )!
  const hostTrace = output.traces.find((trace) =>
    targetLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const labelConnectorTrace = output.traces.find(
    (trace) =>
      trace.mspPairId !== hostTrace.mspPairId &&
      trace.globalConnNetId === targetLabel.globalConnNetId &&
      tracePathContainsPoint(trace.tracePath, targetLabel.anchorPoint),
  )!

  expect(
    getMinimumDistanceBetweenTracePaths({
      firstPath: hostTrace.tracePath,
      secondPath: labelConnectorTrace.tracePath,
    }),
  ).toBe(0)
  expect(hostTrace.tracePath[1]!.x).toBeCloseTo(expectedAlignedRailX)
  expect(targetLabel.anchorPoint.x).toBeCloseTo(expectedCloserLabelAnchorX)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
