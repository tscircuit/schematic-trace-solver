import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260707T092615Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T092615Z", () => {
  const solver = new SchematicTracePipelineSolver({
    inputProblem: inputProblem as any,
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
