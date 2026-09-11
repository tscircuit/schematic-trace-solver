import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260907T110144Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260907T110144Z", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
