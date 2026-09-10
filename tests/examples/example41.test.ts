import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import inputProblem from "../assets/example41.json"
import "tests/fixtures/matcher"

test("example41", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const debugLabel = output.netLabelPlacements.find(
    (label) => label.netId === "SWD",
  )!
  // A branch from the host wire must keep the crowded signal label horizontal.
  expect(["x-", "x+"]).toContain(debugLabel.orientation)
  expect(getOutputLabelCollisions(output)).toEqual([])
  expect(
    output.traces.some(
      (trace) =>
        trace.globalConnNetId === debugLabel.globalConnNetId &&
        tracePathContainsPoint(trace.tracePath, debugLabel.anchorPoint),
    ),
  ).toBe(true)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
