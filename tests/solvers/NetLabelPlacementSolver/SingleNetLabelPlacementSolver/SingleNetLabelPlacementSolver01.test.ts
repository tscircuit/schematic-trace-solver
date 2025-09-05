import { expect, test } from "bun:test"
import { SingleNetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"
import { input } from "site/SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver01.page"
import "tests/fixtures/matcher"

test("SingleNetLabelPlacementSolver01 issue reproduction (should pass)", () => {
  const solver = new SingleNetLabelPlacementSolver(input as any)

  solver.solve()

  console.log("tested candidates", solver.testedCandidates)
  expect(solver.solved).toBe(true)
})
