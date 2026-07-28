import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260728T225606Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260728T225606Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const routedPinPairs = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.map((trace) => new Set(trace.pinIds))

  expect(
    routedPinPairs.some(
      (pinIds) =>
        pinIds.has("schematic_port_3") && pinIds.has("schematic_port_56"),
    ),
  ).toBe(true)
  expect(
    routedPinPairs.some(
      (pinIds) =>
        pinIds.has("schematic_port_4") && pinIds.has("schematic_port_57"),
    ),
  ).toBe(true)
  expect(
    routedPinPairs.some(
      (pinIds) =>
        pinIds.has("schematic_port_7") && pinIds.has("schematic_port_60"),
    ),
  ).toBe(true)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
