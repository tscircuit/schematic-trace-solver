import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-board-589-regulator-section.input.json"

const EXPECTED_ALIGNED_JUNCTION_COUNT = 1

test("board 589 regulator section trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const junctionOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const v3V3Label = junctionOutput.netLabelPlacements.find(
    (label) => label.netId === "V3_3",
  )!
  const labeledTrace = junctionOutput.traces.find((trace) =>
    v3V3Label.mspConnectionPairIds.includes(trace.mspPairId),
  )!

  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.alignedJunctionCount,
  ).toBe(EXPECTED_ALIGNED_JUNCTION_COUNT)
  expect(
    tracePathContainsPoint(labeledTrace.tracePath, v3V3Label.anchorPoint),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
