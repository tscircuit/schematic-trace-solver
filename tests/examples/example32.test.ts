import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example32.json"
import "tests/fixtures/matcher"

test("example31 -> VCC net labels should be at a corner whenever feasible", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const batteryToSwitchTrace =
    solver.schematicTraceLinesSolver?.solvedTracePaths.find(
      (trace) =>
        trace.pinIds.includes("B1.1") && trace.pinIds.includes("SW1.1"),
    )
  expect(batteryToSwitchTrace).toBeDefined()
  expect(
    Math.min(...batteryToSwitchTrace!.tracePath.map((point) => point.y)),
  ).toBeGreaterThan(2.96)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
