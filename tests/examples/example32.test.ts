import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example32-fix-extra-trace-lines.page"
import "tests/fixtures/matcher"

/**
 * Test for Issue #78: Fix extra trace lines in post-processing step.
 *
 * This circuit creates crossing traces that force the UntangleTraceSubsolver
 * to reroute L-shaped corners. Before the fix, the rerouting produced
 * consecutive duplicate points in trace paths, rendering as extra zero-length
 * trace segments.
 *
 * After the fix, removeDuplicateConsecutivePoints in _applyBestRoute()
 * eliminates these artifacts.
 */
test("example32: no extra trace lines from duplicate consecutive points", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
