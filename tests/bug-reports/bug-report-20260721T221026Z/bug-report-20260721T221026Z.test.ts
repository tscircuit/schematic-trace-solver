import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { pathEntersAnyNetLabel } from "lib/solvers/SameNetJunctionAlignmentSolver/pathIntersectsAnyNetLabel"
import inputProblem from "./bug-report-20260721T221026Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260721T221026Z", async () => {
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
  const powerTrace = output.traces.find(
    (trace) => trace.mspPairId === "U_MCU.48-U_MCU.44",
  )!
  const neighboringPowerLabel = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("U_MCU.42"),
  )!

  // The V3V3 detour must clear both the DM/DP tags and the neighboring
  // V3V3 label. Check actual collisions, not only their total count.
  expect(getOutputLabelCollisions(output)).toEqual([])
  expect(
    pathEntersAnyNetLabel({
      path: powerTrace.tracePath,
      netLabelPlacements: [neighboringPowerLabel],
    }),
  ).toBe(false)
  expect(
    output.traces.some(
      (trace) =>
        trace.globalConnNetId === neighboringPowerLabel.globalConnNetId &&
        tracePathContainsPoint(
          trace.tracePath,
          neighboringPowerLabel.anchorPoint,
        ),
    ),
  ).toBe(true)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
