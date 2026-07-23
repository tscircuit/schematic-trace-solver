import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/bugreport-001-gnd-overlap.input.json"
import "tests/fixtures/matcher"

test("bugreport-001-gnd-overlap", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(
    solver.netLabelPlacementSolver!.netLabelPlacements.some(
      (placement) => placement.netId === "GND",
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
