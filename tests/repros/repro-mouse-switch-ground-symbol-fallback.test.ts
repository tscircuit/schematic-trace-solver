import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-mouse-switch-ground-symbol-fallback.input.json"

// Captured from @tscircuit/core 0.0.1947 at commit f5cf2fab.
// Core restricts GND to y-, but label-collision fallback moves it to y+.
test("repro mouse switch GND label fallback ignores allowed orientation", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const groundLabel = solver
    .netLabelNetLabelCollisionSolver!.getOutput()
    .netLabelPlacements.find((label) => label.netId === "GND")

  expect(inputProblem.availableNetLabelOrientations.GND).toEqual(["y-"])
  expect(groundLabel?.orientation).toBe("y+")
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
