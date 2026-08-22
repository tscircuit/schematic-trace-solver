import { test, expect } from "bun:test"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example16.json"
import "tests/fixtures/matcher"

test("example16", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const gndLabelAtJ1Pin3 = solver
    .netLabelNetLabelCollisionSolver!.getOutput()
    .netLabelPlacements.find((label) => label.pinIds.includes("J1.3"))
  expect(gndLabelAtJ1Pin3?.orientation).toBe("y-")

  const differentNetIntersections: string[] = []
  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      const trace = traces[i]!
      const otherTrace = traces[j]!
      if (trace.globalConnNetId === otherTrace.globalConnNetId) continue
      if (countPathIntersections(trace.tracePath, otherTrace.tracePath) > 0) {
        differentNetIntersections.push(
          `${trace.mspPairId}::${otherTrace.mspPairId}`,
        )
      }
    }
  }
  expect(differentNetIntersections).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
