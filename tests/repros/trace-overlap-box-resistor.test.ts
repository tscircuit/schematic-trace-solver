import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro126-trace-overlap-box-resistor.input.json"
import "tests/fixtures/matcher"

test("repro126 trace overlaps R2 box", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  // GND is a net-label-only connection (only in netConnections, no direct
  // connection between U1.3 and R2.2). Net-label-only nets no longer produce
  // MSP pairs, so no routed trace exists between these pins.
  expect(
    solver.traceOverlapShiftSolver!.correctedTraceMap["U1.3-R2.2"],
  ).toBeUndefined()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
