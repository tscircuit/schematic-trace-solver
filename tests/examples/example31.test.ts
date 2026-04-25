import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example31-merge-same-net-traces.page"
import "tests/fixtures/matcher"

/**
 * Test for Issue #34: Merge same-net trace lines that are close together.
 *
 * This circuit has two VCC traces connecting from opposite sides of U1
 * to R1 and R2. These traces may produce parallel segments that run
 * close together. After the merge step, they should be aligned.
 */
test("example31: merge same-net trace lines close together", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
