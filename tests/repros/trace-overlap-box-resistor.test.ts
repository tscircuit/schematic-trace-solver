import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro126-trace-overlap-box-resistor.input.json"
import "tests/fixtures/matcher"

test("repro126 trace overlaps R2 box", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  // U1.3 and R2.2 share GND only via a netConnection. Per the project
  // contract ("Net connections will not be routed, net labels are placed
  // instead."), no wire trace should be drawn between them.
  expect(
    solver.traceOverlapShiftSolver!.correctedTraceMap["U1.3-R2.2"],
  ).toBeUndefined()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
