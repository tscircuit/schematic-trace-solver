import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-dc-power-isolated-routing.input.json"

test("isolated DC power regulator trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.failed).toBe(false)
  expect(
    solver.netLabelToTraceSolver!.outputTraces.some(
      (trace) =>
        trace.pinIds.includes("schematic_port_1") &&
        trace.pinIds.includes("schematic_port_10"),
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
