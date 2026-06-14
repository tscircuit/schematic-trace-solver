import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro126-trace-overlap-box-resistor.input.json"
import "tests/fixtures/matcher"

test("repro126 net-label-only connection does not route through R2 box", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(
    solver.traceOverlapShiftSolver!.correctedTraceMap["U1.3-R2.2"],
  ).toBeUndefined()
  expect(
    solver
      .netLabelPlacementSolver!.netLabelPlacements.filter(
        (label) => label.netId === "GND",
      )
      .flatMap((label) => label.pinIds)
      .sort(),
  ).toEqual(["R2.2", "U1.3"])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
