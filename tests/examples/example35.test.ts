import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example35.json"
import "tests/fixtures/matcher"

// Repro for tscircuit/schematic-trace-solver#79 (repro61 in tscircuit/core):
// two capacitors whose pins are only connected via net labels (no direct
// connection). The solver used to "jump" a trace between the net-label-only
// pins instead of giving each pin its own net label. Each pin should get its
// own net label and no connecting trace should be drawn.
test("example35", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  // No connecting trace should be created for net-label-only nets.
  const connectingTraces = (
    solver.availableNetOrientationSolver?.traces ?? []
  ).filter((t) => t.pins[0]!.pinId !== t.pins[1]!.pinId)
  expect(connectingTraces.length).toBe(0)

  // Each of the four pins should receive its own net label.
  const labels =
    solver.netLabelTraceCollisionSolver?.outputNetLabelPlacements ?? []
  expect(labels.length).toBe(4)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
