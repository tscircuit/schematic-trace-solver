import { expect, test } from "bun:test"
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
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
