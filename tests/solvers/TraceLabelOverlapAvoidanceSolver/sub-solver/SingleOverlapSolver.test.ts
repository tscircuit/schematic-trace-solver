import { expect } from "bun:test"
import { test } from "bun:test"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import inputData from "../../../assets/SingleOverlapSolver.test.input.json"

test("SingleOverlapSolver snapshot", () => {
  const solver = new SingleOverlapSolver(inputData as any)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
