import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260901T055358Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260901T055358Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const groundLabelConnector = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find(
      (trace) => trace.mspPairId === "available-net-orientation-19-GND",
    )
  expect(groundLabelConnector).toBeDefined()
  expect(groundLabelConnector!.tracePath).toHaveLength(2)
  expect(groundLabelConnector!.tracePath.every((point) => point.y === 3)).toBe(
    true,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
