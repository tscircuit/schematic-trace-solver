import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260707T230831Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T230831Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const shortTrace = output.traces.find(
    (trace) => trace.pinIds.includes("U1.7") && trace.pinIds.includes("L1.2"),
  )

  expect(shortTrace?.tracePath).toHaveLength(5)
  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.some(
      (pair) => pair.mspPairId === "U1.7-L1.2",
    ),
  ).toBe(false)
  expect(
    output.netLabelPlacements.some(
      (label) => label.pinIds.includes("U1.7") || label.pinIds.includes("L1.2"),
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
