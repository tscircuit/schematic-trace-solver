import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/f1c-voltage-compatible.json"
import "tests/fixtures/matcher"

// Captured from tscircuit/core PR #4334 at d84f47b7329e8fd1e3092124f604ffe109096559:
// tests/drc/source-pin-voltage-compatible-f1c.test.tsx, via solver:started.
test("F1C AVCC and regulator VOUT connect with a straight trace", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)

  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(output.traces).toHaveLength(1)
  expect(output.traces[0]!.tracePath).toEqual([
    { x: 1.85, y: 0 },
    { x: -1.85, y: 0 },
  ])
  expect(output.inlineNetLabelPlacements).toHaveLength(1)
  expect(output.inlineNetLabelPlacements[0]!.stubTracePath).toBeUndefined()
  expect(output.inlineNetLabelPlacements[0]!.pinIds).toHaveLength(2)
})
