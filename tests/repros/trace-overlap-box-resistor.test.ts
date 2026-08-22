import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro126-trace-overlap-box-resistor.input.json"
import "tests/fixtures/matcher"

test("repro126 trace overlaps R2 box", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(
    solver.traceOverlapShiftSolver!.correctedTraceMap["U1.3-R2.2"],
  ).toBeDefined()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
