import { expect } from "bun:test"
import { test } from "bun:test"
import { SchematicTracePipelineSolver, type InputProblem } from "lib/index"
import "tests/fixtures/matcher"

const inputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 2,
      height: 2,
      pins: [
        {
          pinId: "CORNERS.1",
          x: -1.4,
          y: -0.6,
        },
        {
          pinId: "CORNERS.2",
          x: -1.4,
          y: 0.6,
        },
        {
          pinId: "CORNERS.3",
          x: 1.4,
          y: 0.6,
        },
        {
          pinId: "CORNERS.4",
          x: 1.4,
          y: -0.6,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 4.785,
        y: -0.3999999999999999,
      },
      width: 1.2000000000000002,
      height: 1,
      pins: [
        {
          pinId: "U100.1",
          x: 3.785,
          y: -0.29999999999999993,
        },
        {
          pinId: "U100.2",
          x: 4.785,
          y: -1.2999999999999998,
        },
        {
          pinId: "U100.3",
          x: 3.785,
          y: -0.4999999999999999,
        },
        {
          pinId: "U100.5",
          x: 5.785,
          y: -0.3999999999999999,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 6.7,
        y: -0.9499999999999993,
      },
      width: 0.53,
      height: 1.06,
      pins: [
        {
          pinId: "C101.1",
          x: 6.7,
          y: -0.39999999999999925,
        },
        {
          pinId: "C101.2",
          x: 6.7,
          y: -1.4999999999999993,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: 2.8699999999999997,
        y: -1.75,
      },
      width: 0.53,
      height: 1.06,
      pins: [
        {
          pinId: "C100.1",
          x: 2.8699999999999997,
          y: -1.2,
        },
        {
          pinId: "C100.2",
          x: 2.8699999999999997,
          y: -2.3,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 2.9752723250000006,
        y: 0.050000000000000266,
      },
      width: 0.3194553499999995,
      height: 1.06,
      pins: [
        {
          pinId: "R100.1",
          x: 2.9752723250000006,
          y: 0.6000000000000001,
        },
        {
          pinId: "R100.2",
          x: 2.9752723250000006,
          y: -0.4999999999999998,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["C101.1", "U100.5"],
      netId: "group > capacitor.C101 > port.pin1 to U100.VOUT",
    },
    {
      pinIds: ["C100.1", "U100.1"],
      netId: "group > capacitor.C100 > port.pin1 to U100.VIN",
    },
    {
      pinIds: ["R100.2", "U100.3"],
      netId: "group > resistor.R100 > port.pin2 to U100.EN",
    },
  ],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["CORNERS.1", "CORNERS.4", "U100.2", "C101.2", "C100.2"],
      netLabelWidth: 0.3,
    },
    {
      netId: "VIN",
      pinIds: ["CORNERS.2", "U100.1", "C100.1", "R100.1"],
      netLabelWidth: 0.3,
    },
    {
      netId: "VOUT",
      pinIds: ["CORNERS.3", "U100.5", "C101.1"],
      netLabelWidth: 0.4,
    },
    {
      netId: "LDO_EN",
      pinIds: ["U100.3", "R100.2"],
      netLabelWidth: 0.6,
    },
  ],
  availableNetLabelOrientations: {
    GND: ["y-"],
    VIN: ["y+"],
    VOUT: ["y+"],
    LDO_EN: ["x-", "x+"],
  },
  maxMspPairDistance: 2.4,
} as InputProblem

test("example21", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
