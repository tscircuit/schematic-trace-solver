import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { isVertical } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-smartwatch-power-sheet.input.json"

const MIN_CONNECTOR_GROUND_RAIL_EXTENSION = 0.2

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
  const output = solver.netLabelToTraceSolver!.getOutput()
  const connectorGroundLabels = output.netLabelPlacements.filter((label) =>
    label.pinIds.some((pinId) => connectorGroundPinIds.has(pinId)),
  )
  expect(connectorGroundLabels).toHaveLength(1)
  const connectorGroundLabel = connectorGroundLabels[0]!
  const connectorGroundPins = inputProblem.chips.flatMap((chip) =>
    chip.pins.filter((pin) => connectorGroundPinIds.has(pin.pinId)),
  )
  const connectorGroundHostTrace = output.traces.find((trace) =>
    connectorGroundLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const verticalHostPoint = connectorGroundHostTrace.tracePath.find(
    (point, index, path) => index > 0 && isVertical(path[index - 1]!, point),
  )!
  const lowestConnectorGroundPinY = Math.min(
    ...connectorGroundPins.map((pin) => pin.y),
  )
  const tracesAtConnectorGroundLabel = output.traces.filter((trace) =>
    tracePathContainsPoint(trace.tracePath, connectorGroundLabel.anchorPoint),
  )

  expect(connectorGroundLabel.orientation).toBe("y-")
  expect(connectorGroundLabel.anchorPoint.x).toBeCloseTo(verticalHostPoint.x)
  expect(connectorGroundLabel.anchorPoint.y).toBeCloseTo(
    lowestConnectorGroundPinY - MIN_CONNECTOR_GROUND_RAIL_EXTENSION,
  )
  expect(tracesAtConnectorGroundLabel).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
