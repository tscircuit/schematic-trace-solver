import { expect, test } from "bun:test"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import { tracePathCrossesAnyBounds } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import "tests/fixtures/matcher"

// Reduced from the PMP11282 reproduction. Q504.pin3 and H501 preserve the
// original schematic_port_186 and schematic_component_104 geometry. The
// production net-label placement enters this solver as an x+ label, while
// GND1 requires y- orientation.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "Q504",
      center: { x: -5.903875, y: 1.825 },
      width: 2.1,
      height: 0.6,
      pins: [
        { pinId: "Q504.pin1", x: -6.953875, y: 1.925 },
        { pinId: "Q504.pin2", x: -6.953875, y: 1.725 },
        { pinId: "Q504.pin3", x: -4.853875, y: 1.825 },
      ],
    },
    {
      chipId: "H501",
      center: { x: -5.319875, y: 2.15715 },
      width: 2.6,
      height: 0.4,
      pins: [
        { pinId: "H501.pin1", x: -6.619875, y: 2.15715 },
        { pinId: "H501.pin2", x: -4.019875, y: 2.15715 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND1",
      netLabelWidth: 0.42,
      netLabelHeight: 0.6,
      pinIds: ["Q504.pin3"],
    },
  ],
  textBoxes: [
    {
      chipId: "H501",
      center: { x: -5.439875, y: 1.82715 },
      width: 1.56,
      height: 0.18,
      text: "513101B02500G",
    },
  ],
  availableNetLabelOrientations: { GND1: ["y-"] },
  maxMspPairDistance: 100,
}

const initialNetLabelPlacements: NetLabelPlacement[] = [
  {
    globalConnNetId: "connectivity_net4",
    netId: "GND1",
    mspConnectionPairIds: [],
    pinIds: ["Q504.pin3"],
    orientation: "x+",
    anchorPoint: { x: -4.853875, y: 1.825 },
    width: 0.42,
    height: 0.2,
    center: { x: -4.642875, y: 1.825 },
  },
]

test("PMP11282 GND connector exits H501 component text by the nearest edge", () => {
  const solver = new AvailableNetOrientationSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: initialNetLabelPlacements,
  })

  solver.solve()

  const connectorTrace = solver.traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  const componentTextBox = inputProblem.textBoxes![0]!
  const componentTextBounds = getTextBoxBounds(componentTextBox)
  const [source, escapePoint] = connectorTrace.tracePath

  expect(solver.solved).toBe(true)
  expect(connectorTrace).toBeDefined()
  expect(escapePoint!.x).toBe(source!.x)
  expect(escapePoint!.y).toBeLessThan(componentTextBounds.minY)
  expect(
    tracePathCrossesAnyBounds(
      connectorTrace.tracePath.slice(1),
      componentTextBounds,
    ),
  ).toBe(false)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
