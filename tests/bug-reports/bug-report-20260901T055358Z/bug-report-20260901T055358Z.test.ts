import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260901T055358Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260901T055358Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const groundLabelConnectorId = "available-net-orientation-19-GND"
  const preAlignmentOutput =
    solver.preAlignmentNetLabelTraceCollisionSolver!.getOutput()
  const groundLabelConnector = preAlignmentOutput.traces.find(
    (trace) => trace.mspPairId === groundLabelConnectorId,
  )
  const cc2Label = preAlignmentOutput.netLabelPlacements.find(
    (label) => label.netId === "CC2",
  )

  expect(cc2Label?.orientation).toBe("y-")
  expect(
    preAlignmentOutput.completedReroutes.some(
      (reroute) => reroute.initialTrace.mspPairId === groundLabelConnectorId,
    ),
  ).toBe(false)
  expect(groundLabelConnector).toBeDefined()
  expect(groundLabelConnector!.tracePath).toHaveLength(2)
  expect(groundLabelConnector!.tracePath.every((point) => point.y === 3)).toBe(
    true,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
