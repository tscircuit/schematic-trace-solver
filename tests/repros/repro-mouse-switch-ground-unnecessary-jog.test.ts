import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-mouse-switch-ground-unnecessary-jog.input.json"

// Captured from @tscircuit/core 0.0.1829 at commit b761dc8.
// The GND route should use one straight vertical trunk between its terminal
// stubs instead of adding the unnecessary horizontal step near the midpoint.
test("repro unnecessary jog in mouse switch ground trunk", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const inlineOutput = solver.inlineNetLabelSolver!.getOutput()
  const groundLabel = inlineOutput.netLabelPlacements.find(
    (label) => label.netId === "GND",
  )
  expect(groundLabel?.orientation).toBe("y-")
  expect(
    inlineOutput.inlineNetLabelPlacements.some(
      (label) => label.netId === "RIGHT",
    ),
  ).toBe(true)
  expect(
    inlineOutput.netLabelPlacements.some((label) => label.netId === "RIGHT"),
  ).toBe(false)
  expect(getOutputLabelCollisions(inlineOutput)).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
