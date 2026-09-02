import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-smartwatch-power-sheet.input.json"

const MAX_CONNECTOR_GROUND_LABEL_DISTANCE = 1

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
  const connectorGroundLabel = connectorGroundLabels[0]!
  const connectorGroundPins = inputProblem.chips.flatMap((chip) =>
    chip.pins.filter((pin) => connectorGroundPinIds.has(pin.pinId)),
  )
  const connectorGroundLabelDistance = Math.min(
    ...connectorGroundPins.map((pin) =>
      Math.hypot(
        connectorGroundLabel.anchorPoint.x - pin.x,
        connectorGroundLabel.anchorPoint.y - pin.y,
      ),
    ),
  )

  expect(connectorGroundLabelDistance).toBeLessThanOrEqual(
    MAX_CONNECTOR_GROUND_LABEL_DISTANCE,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
