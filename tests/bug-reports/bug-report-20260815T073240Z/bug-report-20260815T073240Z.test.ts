import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "./bug-report-20260815T073240Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260815T073240Z", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.alignedJunctionCount,
  ).toBe(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
