import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260716T144856Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260716T144856Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  // The capacitor leaves no clear lateral corridor. Keep this compact route
  // instead of adding a loop around the capacitor to reduce a label overlap.
  expect(solver.inlineNetLabelSolver!.getOutput().traces).toEqual(
    solver.inlineNetLabelSolver!.getConstructorParams()[0].traces,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
