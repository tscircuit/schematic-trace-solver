import { expect, test } from "bun:test"
import { SameNetTraceConsolidationSolver } from "lib/solvers/SameNetTraceConsolidationSolver/SameNetTraceConsolidationSolver"
import inputData from "../assets/example42.json"
import "tests/fixtures/matcher"

test("example42", () => {
  const solver = new SameNetTraceConsolidationSolver(inputData as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
