import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./repro-tida00553-j4-cell-divider.input"

test("repro TIDA-00553 J4 cell divider routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const tapNetIds = new Set(["2-Cell tap", "3-Cell tap"])
  const routedTapTraces = output.traces.filter((trace) =>
    tapNetIds.has(trace.userNetId ?? ""),
  )
  const fallbackTapLabels = output.netLabelPlacements.filter((label) =>
    tapNetIds.has(label.netId ?? ""),
  )

  expect(solver.solved).toBe(true)

  // Current mismatch: these short, explicitly direct connections should route
  // from the divider junctions to J4.1/J4.3. Instead, no traces are emitted and
  // the solver replaces both connections with fallback endpoint net labels.
  expect(routedTapTraces).toHaveLength(0)
  expect(fallbackTapLabels.map((label) => label.netId).sort()).toEqual([
    "2-Cell tap",
    "3-Cell tap",
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
