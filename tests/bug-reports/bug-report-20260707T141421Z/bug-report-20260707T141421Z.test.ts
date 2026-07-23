import { expect, test } from "bun:test"
import { doesPathRunAlongChipBoundary } from "lib/solvers/Example28Solver/doesPathRunAlongChipBoundary"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import inputProblem from "./bug-report-20260707T141421Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T141421Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const chipObstacles = getObstacleRects(solver.inputProblem)
  const rLoadToC2Trace = solver.netLabelNetLabelCollisionSolver!.traces.find(
    (trace) =>
      trace.pinIds.includes("R_LOAD.2") && trace.pinIds.includes("C2.2"),
  )

  expect(
    doesPathRunAlongChipBoundary(rLoadToC2Trace!.tracePath, chipObstacles),
  ).toBe(false)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
