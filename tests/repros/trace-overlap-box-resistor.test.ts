import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro126-trace-overlap-box-resistor.input.json"
import "tests/fixtures/matcher"

test("repro126 net-label-only GND connection does not create a trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(
    solver.traceOverlapShiftSolver!.correctedTraceMap["U1.3-R2.2"],
  ).toBeUndefined()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
