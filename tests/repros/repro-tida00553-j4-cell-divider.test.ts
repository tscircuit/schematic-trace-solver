import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./repro-tida00553-j4-cell-divider.input"

test("repro TIDA-00553 J4 cell divider routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const tapNetIds = new Set(["2-Cell/J4-R28", "3-Cell/J4-R28"])
  const routedTapTraces = output.traces.filter((trace) =>
    tapNetIds.has(trace.userNetId ?? ""),
  )
  const fallbackTapLabels = output.netLabelPlacements.filter((label) =>
    tapNetIds.has(label.netId ?? ""),
  )

  expect(solver.solved).toBe(true)

  // Current mismatch: both direct tap connections are routed, but the solver
  // also emits fallback endpoint labels for them. Those labels appear as XX in
  // the rendered schematic instead of the clean vertical traces in the source.
  expect(routedTapTraces).toHaveLength(2)
  expect(fallbackTapLabels.map((label) => label.netId).sort()).toEqual([
    "2-Cell/J4-R28",
    "3-Cell/J4-R28",
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
