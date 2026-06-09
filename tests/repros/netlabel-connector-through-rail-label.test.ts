import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import ip from "./assets/repro-netlabel-connector-through-label.input.json"
import "tests/fixtures/matcher"
import { getTraceLabelCollisions } from "tests/fixtures/traceLabelCollisions"

test("netlabel connector trace should not pass through a rail label", () => {
  const solver = new SchematicTracePipelineSolver(ip as any)
  solver.solve()

  expect(
    getTraceLabelCollisions(
      solver.netLabelNetLabelCollisionSolver!.traces,
      solver.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements,
    ),
  ).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
