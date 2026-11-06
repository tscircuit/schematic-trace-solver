import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20261102T175956Z.json"
import "tests/fixtures/matcher"

test("bug-report-20261102T175956Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(getOutputLabelCollisions(output)).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
