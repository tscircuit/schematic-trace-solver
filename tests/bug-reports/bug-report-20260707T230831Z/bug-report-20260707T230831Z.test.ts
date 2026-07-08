import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260707T230831Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T230831Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const shortTracePaths = solver.schematicTraceLinesSolver!.solvedTracePaths
    .filter((trace) =>
      ["U1.9-L1.1", "U1.7-L1.2"].includes(trace.mspPairId),
    )
    .map((trace) => trace.tracePath)

  expect(shortTracePaths).toHaveLength(2)
  expect(
    shortTracePaths.every((path) => {
      const length = path.slice(1).reduce((sum, point, index) => {
        const prev = path[index]!
        return sum + Math.abs(point.x - prev.x) + Math.abs(point.y - prev.y)
      }, 0)

      return length < 0.15
    }),
  ).toBe(true)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
