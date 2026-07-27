import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tps61222-trace-intersection.input.json"

// Extracted from https://github.com/tscircuit/core/pull/2785 with
// DEBUG=Group_doInitialSchematicTraceRender.
test("repro TPS61222 schematic trace intersection", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  const manufacturerPartNumberTextBox = inputProblem.textBoxes.find(
    (textBox) => textBox.text === "TPS61222DCKT",
  )
  expect(manufacturerPartNumberTextBox).toBeDefined()

  const textBounds = getTextBoxBounds(manufacturerPartNumberTextBox!)
  solver.solveUntilPhase("longDistancePairSolver")

  const initialGroundTrace =
    solver.schematicTraceLinesSolver!.solvedTracePaths.find(
      (trace) => trace.mspPairId === "U2.3-C25.2",
    )
  expect(initialGroundTrace).toBeDefined()
  expect(
    isPathCollidingWithObstacles(initialGroundTrace!.tracePath, [textBounds]),
  ).toBe(false)

  solver.solve()

  const crossingTraceIds = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.filter((trace) =>
      isPathCollidingWithObstacles(trace.tracePath, [textBounds]),
    )
    .map((trace) => trace.mspPairId)

  expect(crossingTraceIds).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
