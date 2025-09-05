import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example14.page"
import "tests/fixtures/matcher"

test("example14 - should fail with net label placement collision error", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.failed).toBeTruthy()
  expect(solver.error).toBe("Could not place net label at port without collisions")
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})