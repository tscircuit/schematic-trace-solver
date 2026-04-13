import { test, expect } from "bun:test"
import type { InputProblem } from "lib/index"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 1.8,
      height: 2,
      pins: [
        {
          pinId: "U1.1",
          x: -0.2,
          y: 1.4,
        },
        {
          pinId: "U1.2",
          x: -1.3,
          y: 0.09999999999999998,
        },
        {
          pinId: "U1.3",
          x: -1.3,
          y: -0.10000000000000009,
        },
        {
          pinId: "U1.4",
          x: -1.3,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.5",
          x: -1.3,
          y: -0.5,
        },
        {
          pinId: "U1.7",
          x: 0,
          y: -1.4,
        },
        {
          pinId: "U1.8",
          x: -1.3,
          y: 0.5,
        },
        {
          pinId: "U1.10",
          x: 1.3,
          y: -0.5,
        },
        {
          pinId: "U1.11",
          x: 1.3,
          y: -0.3,
        },
        {
          pinId: "U1.12",
          x: 1.3,
          y: -0.09999999999999998,
        },
        {
          pinId: "U1.13",
          x: 1.3,
          y: 0.10000000000000009,
        },
        {
          pinId: "U1.14",
          x: 0.2,
          y: 1.4,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -4,
        y: -0.3,
      },
      width: 0.4,
      height: 1.6,
      pins: [
        {
          pinId: "JP1.1",
          x: -3.4,
          y: -0.8999999999999999,
        },
        {
          pinId: "JP1.2",
          x: -3.4,
          y: -0.7,
        },
        {
          pinId: "JP1.3",
          x: -3.4,
          y: -0.49999999999999994,
        },
        {
          pinId: "JP1.4",
          x: -3.4,
          y: -0.2999999999999999,
        },
        {
          pinId: "JP1.5",
          x: -3.4,
          y: -0.09999999999999992,
        },
        {
          pinId: "JP1.6",
          x: -3.4,
          y: 0.10000000000000003,
        },
        {
          pinId: "JP1.7",
          x: -3.4,
          y: 0.3,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 4,
        y: -0.3,
      },
      width: 0.4,
      height: 1.6,
      pins: [
        {
          pinId: "JP2.1",
          x: 3.4,
          y: -0.8999999999999999,
        },
        {
          pinId: "JP2.2",
          x: 3.4,
          y: -0.7,
        },
        {
          pinId: "JP2.3",
          x: 3.4,
          y: -0.5,
        },
        {
          pinId: "JP2.4",
          x: 3.4,
          y: -0.3000000000000001,
        },
        {
          pinId: "JP2.5",
          x: 3.4,
          y: -0.10000000000000003,
        },
        {
          pinId: "JP2.6",
          x: 3.4,
          y: 0.09999999999999998,
        },
        {
          pinId: "JP2.7",
          x: 3.4,
          y: 0.3,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["JP1.1", "U1.7"],
      netId: "pinheader.JP1 > port.pin1 to .U1 > .pin7",
    },
    {
      pinIds: ["JP1.3", "U1.5"],
      netId: "pinheader.JP1 > port.pin3 to .U1 > .pin5",
    },
    {
      pinIds: ["JP1.4", "U1.4"],
      netId: "pinheader.JP1 > port.pin4 to .U1 > .pin4",
    },
    {
      pinIds: ["JP1.5", "U1.3"],
      netId: "pinheader.JP1 > port.pin5 to .U1 > .pin3",
    },
    {
      pinIds: ["JP1.6", "U1.2"],
      netId: "pinheader.JP1 > port.pin6 to .U1 > .pin2",
    },
    {
      pinIds: ["JP2.3", "U1.10"],
      netId: "pinheader.JP2 > port.pin3 to .U1 > .pin10",
    },
    {
      pinIds: ["JP2.4", "U1.11"],
      netId: "pinheader.JP2 > port.pin4 to .U1 > .pin11",
    },
    {
      pinIds: ["JP2.5", "U1.12"],
      netId: "pinheader.JP2 > port.pin5 to .U1 > .pin12",
    },
    {
      pinIds: ["JP2.6", "U1.13"],
      netId: "pinheader.JP2 > port.pin6 to .U1 > .pin13",
    },
  ],
  netConnections: [
    {
      netId: "V3_3",
      pinIds: ["U1.1", "JP1.2"],
      netLabelWidth: 0.4,
    },
    {
      netId: "GND",
      pinIds: ["U1.7", "JP1.1", "JP2.1"],
      netLabelWidth: 0.3,
    },
    {
      netId: "V5",
      pinIds: ["U1.14", "JP2.2"],
      netLabelWidth: 0.2,
    },
  ],
  availableNetLabelOrientations: {
    V3_3: ["y+"],
    V5: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

test("example01", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
