import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-core-ground-net-label-orientation.input.json"

test("core ground net labels use the requested solver orientation", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  const groundLabels = solver
    .inlineNetLabelSolver!.getOutput()
    .netLabelPlacements.filter((label) => label.netId === "GND")

  expect(groundLabels).toHaveLength(4)
  expect(groundLabels.every((label) => label.orientation === "y-")).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
