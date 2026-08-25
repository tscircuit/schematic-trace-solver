import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const connectorPins = [
  "VBUS1",
  "VBUS2",
  "CC1",
  "CC2",
  "DP1",
  "DP2",
  "DM1",
  "DM2",
  "SBU1",
  "SBU2",
  "GND1",
  "GND2",
].map((name, index) => ({
  pinId: `J1.${name}`,
  x: -1.7,
  y: 1.65 - index * 0.3,
  _facingDirection: "x+" as const,
}))

// Reproduces a TYPE-C-31-M-12 connector with its two VBUS pins joined to a
// resistor/LED chain while the LED cathode shares the connector's GND net.
// The distant GND endpoints should be represented by separate net labels.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "J1",
      center: { x: -3, y: 0 },
      width: 2.6,
      height: 4,
      pins: connectorPins,
    },
    {
      chipId: "R1",
      center: { x: 0, y: 1.5 },
      width: 0.8,
      height: 0.5,
      pins: [
        {
          pinId: "R1.1",
          x: -0.4,
          y: 1.5,
          _facingDirection: "x-",
        },
        {
          pinId: "R1.2",
          x: 0.4,
          y: 1.5,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "D1",
      center: { x: 3, y: 1.5 },
      width: 1,
      height: 0.8,
      pins: [
        {
          pinId: "D1.1",
          x: 2.5,
          y: 1.5,
          _facingDirection: "x-",
        },
        {
          pinId: "D1.2",
          x: 3.5,
          y: 1.5,
          _facingDirection: "x+",
        },
      ],
    },
  ],
  directConnections: [
    {
      netId: "VBUS_LED",
      pinIds: ["R1.2", "D1.1"],
    },
  ],
  netConnections: [
    {
      netId: "VBUS",
      pinIds: ["J1.VBUS1", "J1.VBUS2", "R1.1"],
      netLabelWidth: 0.48,
      netLabelHeight: 0.48,
    },
    {
      netId: "J1_GND1",
      pinIds: ["J1.GND1", "J1.GND2", "D1.2"],
      netLabelWidth: 0.78,
      netLabelHeight: 0.48,
    },
  ],
  textBoxes: [
    {
      chipId: "J1",
      center: { x: -3, y: 2.3 },
      width: 1.6,
      height: 0.2,
      text: "J1 TYPE-C-31-M-12",
    },
    {
      chipId: "R1",
      center: { x: 0, y: 1.95 },
      width: 0.4,
      height: 0.2,
      text: "R1 1kΩ",
    },
    {
      chipId: "D1",
      center: { x: 3, y: 2.15 },
      width: 0.5,
      height: 0.2,
      text: "D1 white",
    },
  ],
  availableNetLabelOrientations: {
    VBUS: ["x+", "y+"],
    J1_GND1: ["y-", "x+"],
  },
  maxMspPairDistance: 2.4,
}

test("routes TYPE-C-31-M-12 VBUS through an LED with shared GND labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.netLabelNetLabelCollisionSolver!.getOutput()
  const gndLabels = output.netLabelPlacements.filter(
    (label) => label.netId === "J1_GND1",
  )

  const recoveredGroundTrace =
    solver.longDistancePairSolver!.solvedLongDistanceTraces.find(
      (trace) =>
        trace.pinIds.includes("D1.2") &&
        (trace.pinIds.includes("J1.GND1") || trace.pinIds.includes("J1.GND2")),
    )
  const localGroundTrace = solver
    .traceCleanupSolver2!.getOutput()
    .traces.find(
      (trace) =>
        trace.pinIds.includes("J1.GND1") && trace.pinIds.includes("J1.GND2"),
    )

  expect(recoveredGroundTrace).toBeDefined()
  expect(gndLabels).toHaveLength(1)
  expect(localGroundTrace!.tracePath).toEqual([
    { x: -1.7, y: -1.65 },
    { x: -1.5, y: -1.65 },
    { x: -1.5, y: -1.35 },
    { x: -1.7, y: -1.35 },
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
