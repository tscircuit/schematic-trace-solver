import { expect, test } from "bun:test"
import { tracePathsHaveInteriorIntersection } from "lib/solvers/GroundTraceCrossingFilterSolver/getGroundTracesToReplaceWithLabels"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260721T221026Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260721T221026Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traces = solver.sameNetJunctionAlignmentSolver!.getOutput().traces
  const crossingGroundTraces = traces.filter((groundTrace) => {
    if (groundTrace.userNetId !== "GND") return false
    return traces.some(
      (otherTrace) =>
        otherTrace.globalConnNetId !== groundTrace.globalConnNetId &&
        tracePathsHaveInteriorIntersection({
          firstTracePath: groundTrace.tracePath,
          secondTracePath: otherTrace.tracePath,
        }),
    )
  })

  expect(crossingGroundTraces).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
