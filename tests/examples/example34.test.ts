import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example34.json"
import "tests/fixtures/matcher"
import { getTraceLabelCollisions } from "tests/fixtures/traceLabelCollisions"

test("example34", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    getTraceLabelCollisions(
      solver.netLabelNetLabelCollisionSolver!.traces,
      solver.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements,
    ),
  ).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
