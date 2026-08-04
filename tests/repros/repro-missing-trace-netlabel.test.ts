import { expect, test } from "bun:test"
import { getTraceCorners } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-missing-trace-netlabel.input.json"
import "tests/fixtures/matcher"

// Regression (from @tscircuit/core repro148): the RESET connection between R3 and
// SW2 used to route as a trace but now falls back to two net labels.
test("repro148 missing trace becomes net labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const powerLabel = output.netLabelPlacements.find(
    (label) => label.netId === "V3V3",
  )!
  const powerTrace = output.traces.find((trace) =>
    powerLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!

  expect(getTraceCorners(powerTrace.tracePath)).toContainEqual(
    powerLabel.anchorPoint,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
