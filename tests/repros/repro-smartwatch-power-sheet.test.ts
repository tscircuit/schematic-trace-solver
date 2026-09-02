import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-smartwatch-power-sheet.input.json"

test("smartwatch power sheet", () => {
  const inputProblemJson: InputProblem = JSON.parse(
    JSON.stringify(inputProblem),
  )
  const solver = new SchematicTracePipelineSolver(inputProblemJson, {
    hideRatsNet: true,
  })
  solver.solve()

  const connectorGroundPinIds = new Set([
    "schematic_port_0",
    "schematic_port_11",
  ])
  const output = solver.netLabelToTraceSolver!.getOutput()
  const connectorGroundLabels = output.netLabelPlacements.filter((label) =>
    label.pinIds.some((pinId) => connectorGroundPinIds.has(pinId)),
  )
  expect(connectorGroundLabels).toHaveLength(1)
  const connectorGroundLabel = connectorGroundLabels[0]!
  const tracesAtConnectorGroundLabel = output.traces.filter((trace) =>
    tracePathContainsPoint(trace.tracePath, connectorGroundLabel.anchorPoint),
  )

  expect(connectorGroundLabel.orientation).toBe("y-")
  expect(tracesAtConnectorGroundLabel).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
