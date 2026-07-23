import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import inputProblem from "./bug-report-20260708T095725Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260708T095725Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const manufacturerPartNumberTextBox = inputProblem.textBoxes.find(
    (textBox) => textBox.text === "TPS923655DMTR",
  )
  expect(manufacturerPartNumberTextBox).toBeDefined()

  const textBounds = getTextBoxBounds(manufacturerPartNumberTextBox!)
  const crossingTraceIds = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.filter((trace) =>
      isPathCollidingWithObstacles(trace.tracePath, [textBounds]),
    )
    .map((trace) => trace.mspPairId)

  expect(crossingTraceIds).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
