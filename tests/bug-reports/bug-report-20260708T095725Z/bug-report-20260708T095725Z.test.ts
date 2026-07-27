import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import inputProblem from "./bug-report-20260708T095725Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260708T095725Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  expect(finalTraces.map((trace) => trace.mspPairId)).toContain("U1.14-RTEMP.1")

  const componentTextBounds = inputProblem.textBoxes.map((textBox) =>
    getTextBoxBounds(textBox),
  )
  const crossingTraceIds = finalTraces
    .filter((trace) =>
      isPathCollidingWithObstacles(trace.tracePath, componentTextBounds),
    )
    .map((trace) => trace.mspPairId)

  expect(crossingTraceIds).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
