import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-hdc3020-ground-label-alignment.input.json"

test("repro HDC3020 shared ground rail label alignment", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: true,
    },
  )

  solver.solve()

  const groundLabel = solver
    .availableNetOrientationSolver!.getOutput()
    .netLabelPlacements.find((label) =>
      label.pinIds.includes("schematic_port_6"),
    )

  expect(groundLabel?.anchorPoint.x).toBeCloseTo(0.1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
