import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260707T140410Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T140410Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    output.traces.some(
      (trace) =>
        trace.pinIds.includes("R_NFAULT_PULLUP.2") &&
        trace.pinIds.includes("U1.4"),
    ),
  ).toBe(true)
  expect(
    output.netLabelPlacements.some(
      (label) =>
        label.pinIds.includes("R_NFAULT_PULLUP.2") ||
        label.pinIds.includes("U1.4"),
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
