import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 4.5, y: 0 },
      width: 3.4000000000000004,
      height: 4.6,
      pins: [
        {
          pinId: "schematic_port_0",
          displayName: "VDD",
          x: 2.8,
          y: 0.8500000000000001,
        },
        {
          pinId: "schematic_port_1",
          displayName: "SCL",
          x: 2.8,
          y: 0.4000000000000001,
        },
        {
          pinId: "schematic_port_2",
          displayName: "SDA",
          x: 2.8,
          y: 0.20000000000000007,
        },
        {
          pinId: "schematic_port_3",
          displayName: "GPIO",
          x: 2.8,
          y: 0,
        },
        {
          pinId: "schematic_port_4",
          displayName: "GND",
          x: 2.8,
          y: -0.8500000000000001,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: { x: -2.1, y: 0 },
      width: 4,
      height: 4,
      pins: [
        {
          pinId: "schematic_port_5",
          displayName: "I2C_SDA",
          x: -0.10000000000000009,
          y: 0.5499999999999998,
        },
        {
          pinId: "schematic_port_6",
          displayName: "GND",
          x: -0.10000000000000009,
          y: -1.2000000000000002,
        },
        {
          pinId: "schematic_port_7",
          displayName: "I2C_ADDR",
          x: -0.10000000000000009,
          y: -0.5500000000000002,
        },
        {
          pinId: "schematic_port_8",
          displayName: "DRDY_INT",
          x: -0.10000000000000009,
          y: 0.09999999999999987,
        },
        {
          pinId: "schematic_port_9",
          displayName: "VDD",
          x: -0.10000000000000009,
          y: 1.2000000000000002,
        },
        {
          pinId: "schematic_port_10",
          displayName: "I2C_SCL",
          x: -0.10000000000000009,
          y: 0.7499999999999998,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: { x: 0.7949999999999999, y: 1.3 },
      width: 1.0899999999999999,
      height: 0.6000000000000001,
      pins: [
        {
          pinId: "schematic_port_11",
          displayName: "anode",
          x: 0.7,
          y: 1.6,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_12",
          displayName: "cathode",
          x: 0.7,
          y: 1,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: { x: 1.5949999999999998, y: 1.3 },
      width: 1.0899999999999996,
      height: 0.6000000000000001,
      pins: [
        {
          pinId: "schematic_port_13",
          displayName: "anode",
          x: 1.5,
          y: 1.6,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_14",
          displayName: "cathode",
          x: 1.5,
          y: 1,
          _facingDirection: "y-",
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "VDD",
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: [
        "schematic_port_0",
        "schematic_port_9",
        "schematic_port_11",
        "schematic_port_13",
      ],
    },
    {
      netId: "SCL",
      netLabelWidth: 0.48,
      pinIds: ["schematic_port_1", "schematic_port_10", "schematic_port_12"],
    },
    {
      netId: "SDA",
      netLabelWidth: 0.48,
      pinIds: ["schematic_port_2", "schematic_port_5", "schematic_port_14"],
    },
    {
      netId: "DRDY_INT",
      netLabelWidth: 1.08,
      anchoredNetLabelWidth: 1.08,
      allowInlineNetLabel: true,
      inlineNetLabelHeight: 0.12,
      inlineNetLabelWidth: 0.72,
      pinIds: ["schematic_port_3", "schematic_port_8"],
    },
    {
      netId: "GND",
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: ["schematic_port_4", "schematic_port_6", "schematic_port_7"],
    },
  ],
  textBoxes: [
    {
      chipId: "schematic_component_0",
      center: { x: 3.38, y: -2.4299999999999997 },
      width: 0.3599999999999999,
      height: 0.17999999999999972,
      text: "MCU",
    },
    {
      chipId: "schematic_component_0",
      center: { x: 3.3200000000000003, y: 2.415 },
      width: 0.3600000000000003,
      height: 0.24999999999999956,
      text: "U2",
    },
    {
      chipId: "schematic_component_1",
      center: { x: -3.04, y: -2.13 },
      width: 1.3199999999999998,
      height: 0.17999999999999972,
      text: "HDC2080DMBR",
    },
    {
      chipId: "schematic_component_1",
      center: { x: -3.58, y: 2.1149999999999998 },
      width: 0.3600000000000003,
      height: 0.24999999999999978,
      text: "U1",
    },
  ],
  availableNetLabelOrientations: {
    VDD: ["y+"],
    SCL: ["x-", "x+"],
    SDA: ["x-", "x+"],
    DRDY_INT: ["x-", "x+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
  _hideRatsNet: false,
}

test("aligns the HDC2080 GND label with its vertical rail", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.availableNetOrientationSolver!.getOutput()
  const groundLabel = output.netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_6"),
  )
  const groundRail = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_7-schematic_port_6",
  )
  const groundRailTraces = output.traces.filter(
    (trace) =>
      trace.userNetId === "GND" &&
      trace.pinIds.includes("schematic_port_6") &&
      trace.pinIds.includes("schematic_port_7"),
  )

  expect(groundLabel?.anchorPoint.x).toBeCloseTo(0.1)
  expect(groundRail?.tracePath[1]?.x).toBeCloseTo(0.1)
  expect(groundRailTraces).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
