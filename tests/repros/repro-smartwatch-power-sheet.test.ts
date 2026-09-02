import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { isVertical } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
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
  const output = solver.netLabelToTraceSolver!.getOutput()
  const connectorGroundLabels = output.netLabelPlacements.filter((label) =>
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
  const connectorGroundHostTrace = output.traces.find((trace) =>
    connectorGroundLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const verticalHostPoint = connectorGroundHostTrace.tracePath.find(
    (point, index, path) => index > 0 && isVertical(path[index - 1]!, point),
  )!
  const tracesAtConnectorGroundLabel = output.traces.filter((trace) =>
    tracePathContainsPoint(trace.tracePath, connectorGroundLabel.anchorPoint),
  )

  expect(connectorGroundLabel.anchorPoint.x).toBeCloseTo(verticalHostPoint.x)
  expect(connectorGroundLabelDistance).toBeLessThanOrEqual(
    MAX_CONNECTOR_GROUND_LABEL_DISTANCE,
  )
  expect(tracesAtConnectorGroundLabel).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
