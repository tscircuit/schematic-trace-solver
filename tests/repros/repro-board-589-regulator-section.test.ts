import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-board-589-regulator-section.input.json"

const EXPECTED_ALIGNED_JUNCTION_COUNT = 2

test("board 589 regulator section trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const junctionOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.alignedJunctionCount,
  ).toBe(EXPECTED_ALIGNED_JUNCTION_COUNT)
  for (const netLabelPlacement of junctionOutput.netLabelPlacements) {
    for (const mspConnectionPairId of netLabelPlacement.mspConnectionPairIds) {
      const labeledTrace = junctionOutput.traces.find(
        (trace) => trace.mspPairId === mspConnectionPairId,
      )!
      expect(
        tracePathContainsPoint(
          labeledTrace.tracePath,
          netLabelPlacement.anchorPoint,
        ),
      ).toBe(true)
    }
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
