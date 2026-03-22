import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { issue34InputProblem } from "site/issue-34-input"
import "tests/fixtures/matcher"

test("issue34 full pipeline snapshot (U1/U2 VCC+GND)", async () => {
  const solver = new SchematicTracePipelineSolver(issue34InputProblem)
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
