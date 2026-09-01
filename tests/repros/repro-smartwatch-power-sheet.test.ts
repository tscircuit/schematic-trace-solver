import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-smartwatch-power-sheet.input.json"

test("smartwatch power sheet", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()

  const connectorGroundPinIds = new Set([
    "schematic_port_0",
    "schematic_port_11",
  ])
  const connectorGroundLabels = solver
    .netLabelToTraceSolver!.getOutput()
    .netLabelPlacements.filter((label) =>
      label.pinIds.some((pinId) => connectorGroundPinIds.has(pinId)),
    )
  expect(connectorGroundLabels).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
