import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260902T092101Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260902T092101Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const hostTrace = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_3-schematic_port_5",
  )!
  const feedbackLabelConnector = output.traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-3-BUCK_0V9_FB",
  )!

  expect(feedbackLabelConnector.tracePath).toHaveLength(2)
  expect(
    tracePathContainsPoint(
      hostTrace.tracePath,
      feedbackLabelConnector.tracePath[0]!,
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
