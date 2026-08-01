import { expect } from "vitest"
import { test } from "vitest"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import inputData from "../../../assets/SingleOverlapSolver.test.input.json"

test("SingleOverlapSolver snapshot", () => {
  const solver = new SingleOverlapSolver(inputData as any)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
