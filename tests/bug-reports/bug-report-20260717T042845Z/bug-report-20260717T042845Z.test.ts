import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import inputProblem from "./bug-report-20260717T042845Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260717T042845Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const hostTrace = traces.find((trace) => trace.mspPairId === "F2.1-F1.1")!
  const labelConnector = traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-0-VIN",
  )!
  expect(
    labelConnector.tracePath.some((point) =>
      tracePathContainsPoint(hostTrace.tracePath, point),
    ),
  ).toBe(true)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
