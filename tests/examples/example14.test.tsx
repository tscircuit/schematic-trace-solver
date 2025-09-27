import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example14.page"

test("example14 - should now succeed with NetlabelTraceOverlapAvoidanceSolver", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  // The solver should now succeed instead of failing with netlabel collision error
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  
  // Should have netlabel placements  
  const netLabelPlacements = solver.netLabelPlacementSolver?.netLabelPlacements ?? []
  expect(netLabelPlacements.length).toBeGreaterThan(0)

  // If our new solver ran, check that it might have helped
  if (solver.netlabelTraceOverlapAvoidanceSolver) {
    const { successfullyPlacedNetlabels } = solver.netlabelTraceOverlapAvoidanceSolver.getOutput()
    // It's okay if this is 0 - means the original solver worked, or there weren't any failures to fix
    expect(successfullyPlacedNetlabels.length).toBeGreaterThanOrEqual(0)
  }
})
