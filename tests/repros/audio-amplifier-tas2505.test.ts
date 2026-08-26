import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/audio-amplifier-tas2505.input.json"
import "tests/fixtures/matcher"

test("repro AudioAmplifier TAS2505 schematic traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const alignmentStats = solver.traceCleanupSolver2!.stats
  expect(alignmentStats.alignedRailGroupCount).toBe(2)
  expect(alignmentStats.alignedTraceCount).toBe(4)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
