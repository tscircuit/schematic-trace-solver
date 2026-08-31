import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import inputProblem from "./bug-report-20260831T133233Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260831T133233Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const textBoxBounds = inputProblem.textBoxes.map((textBox) =>
    getTextBoxBounds(textBox),
  )
  const crossingTraceIds = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.filter((trace) =>
      isPathCollidingWithObstacles(trace.tracePath, textBoxBounds),
    )
    .map((trace) => trace.mspPairId)

  expect(crossingTraceIds).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
