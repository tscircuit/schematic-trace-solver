import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example42-merge-same-net-traces.page"
import "tests/fixtures/matcher"

/**
 * Test for same-net trace segment merging (PR #480).
 *
 * Uses 4 VCC traces on the same net that run parallel and close together.
 * After the merging_parallel_segments phase in TraceCleanupSolver, the
 * parallel segments should be aligned to the average Y coordinate.
 *
 * The clustering approach ensures that groups of 3+ parallel segments
 * are merged to their collective average, not just pairwise.
 */
test("example42: merge same-net parallel trace segments", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
