import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { countTurns } from "lib/solvers/TraceCleanupSolver/countTurns"
import inputProblem from "./bug-report-20261012T065717Z.json"
import "tests/fixtures/matcher"

test("bug-report-20261012T065717Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = output.netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_29"),
  )!
  const connector = output.traces.find(
    (trace) =>
      solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
        trace.mspPairId,
      ) && tracePathContainsPoint(trace.tracePath, groundLabel.anchorPoint),
  )!
  expect(groundLabel.orientation).toBe("y-")
  expect(countTurns(connector.tracePath)).toBe(1)
  expect(connector.tracePath.at(-1)).toEqual(groundLabel.anchorPoint)
  expect(connector.tracePath.at(-2)!.x).toBeCloseTo(groundLabel.anchorPoint.x)
  expect(connector.tracePath.at(-2)!.y).toBeGreaterThan(
    groundLabel.anchorPoint.y,
  )
  expect(
    output.traces.some(
      (trace) =>
        trace.mspPairId !== connector.mspPairId &&
        trace.globalConnNetId === groundLabel.globalConnNetId &&
        tracePathContainsPoint(trace.tracePath, connector.tracePath[0]!),
    ),
  ).toBe(true)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
