import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example46.json"
import "tests/fixtures/matcher"

test("example46", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const groundTrace = solver.schematicTraceLinesSolver!.solvedTracePaths.find(
    (trace) => trace.mspPairId === "C4.2-C18.2",
  )!
  const powerTrace = solver.schematicTraceLinesSolver!.solvedTracePaths.find(
    (trace) => trace.mspPairId === "C4.1-C18.1",
  )!
  const componentCenterX = inputProblem.chips.find((chip) =>
    chip.pins.some((pin) => pin.pinId === "C4.1"),
  )!.center.x
  const groundRailX = groundTrace.tracePath[2]!.x
  const powerRailX = powerTrace.tracePath[2]!.x

  expect(
    (groundRailX - componentCenterX) * (powerRailX - componentCenterX),
  ).toBeLessThan(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
