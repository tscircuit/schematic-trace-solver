import { expect } from "bun:test"
import { test } from "bun:test"
import { TraceLabelOverlapAvoidanceSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/TraceLabelOverlapAvoidanceSolver"
import inputProblem from "tests/assets/example25.json"
import "tests/fixtures/matcher"
import testInput from "tests/assets/TraceLabelOverlapAvoidanceSolver.test.input.json"

test("TraceLabelOverlapAvoidanceSolver snapshot", () => {
  const solver = new TraceLabelOverlapAvoidanceSolver({
    inputProblem: inputProblem as any,
    netLabelPlacements: testInput.netLabelPlacements as any,
    traces: testInput.traces as any,
  })

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
