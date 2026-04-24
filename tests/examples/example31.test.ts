import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example31-repro61.page"
import "tests/fixtures/matcher"

test("example31-repro61", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  // Verify that there are NO traces and 2 net labels
  const traceCleanupOutput = solver.traceCleanupSolver!.getOutput()
  expect(traceCleanupOutput.traces).toHaveLength(0)
  
  const netLabelOutput = solver.netLabelPlacementSolver!.netLabelPlacements
  expect(netLabelOutput).toHaveLength(2)
  expect(netLabelOutput[0].netId).toBe("VCC")
  expect(netLabelOutput[1].netId).toBe("VCC")

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
