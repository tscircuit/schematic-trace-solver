import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-gamepad-trace-alignment.input.json"

test("reproduces RP2040 gamepad trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(
    solver.mspConnectionPairSolver!.mspConnectionPairs.some(
      (pair) => pair.userNetId === "GND",
    ),
  ).toBe(false)
  expect(
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements.some(
      (label) => label.netId === "GND",
    ),
  ).toBe(true)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
