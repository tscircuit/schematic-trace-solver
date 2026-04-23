import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example28.page"
import "tests/fixtures/matcher"

test("example28", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const gndLabels = solver
    .getOutput()
    .netLabelPlacements.filter((placement) => placement.netId === "GND")

  expect(gndLabels).toHaveLength(1)
  expect(gndLabels[0]?.orientation).toBe("y-")
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
