import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260724T175257Z.json"
import "tests/fixtures/matcher"

const getInternalVerticalRailX = (tracePath: Array<{ x: number; y: number }>) => {
  for (let i = 1; i < tracePath.length - 2; i++) {
    if (Math.abs(tracePath[i]!.x - tracePath[i + 1]!.x) < 1e-9) {
      return tracePath[i]!.x
    }
  }
  return null
}

test("bug-report-20260724T175257Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traceLinesSolver = solver.schematicTraceLinesSolver!
  expect(traceLinesSolver.failedConnectionPairs).toHaveLength(0)
  expect(
    traceLinesSolver.solvedTracePaths.some((trace) =>
      trace.pinIds.includes("C1.1"),
    ),
  ).toBe(true)
  expect(
    traceLinesSolver.solvedTracePaths.some((trace) =>
      trace.pinIds.includes("C1.2"),
    ),
  ).toBe(true)

  const finalTraces = solver.traceCleanupSolver2!.getOutput().traces
  const c1Pin1Trace = finalTraces.find(
    (trace) => trace.mspPairId === "R1.1-C1.1",
  )!
  const sharedPinTrace = finalTraces.find(
    (trace) => trace.mspPairId === "SW1.2-R1.1",
  )!
  expect(getInternalVerticalRailX(c1Pin1Trace.tracePath)).toBe(
    getInternalVerticalRailX(sharedPinTrace.tracePath),
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
