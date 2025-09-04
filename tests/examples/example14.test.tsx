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
      height: 1.4,
      pins: [
        {
          pinId: "U3.8",
          x: -1.4,
          y: 0.42500000000000004,
        },
        {
          pinId: "U3.4",
          x: -1.4,
          y: -0.42500000000000004,
        },
        {
          pinId: "U3.1",
          x: 1.4,
          y: 0.5,
        },
        {
          pinId: "U3.6",
          x: 1.4,
          y: 0.30000000000000004,
        },
        {
          pinId: "U3.5",
          x: 1.4,
          y: 0.10000000000000009,
        },
        {
          pinId: "U3.2",
          x: 1.4,
          y: -0.09999999999999998,
        },
        {
          pinId: "U3.3",
          x: 1.4,
          y: -0.3,
        },
        {
          pinId: "U3.7",
          x: 1.4,
          y: -0.5,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -2.3145833,
        y: 0,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C20.1",
          x: -2.3148566499999994,
          y: 0.5512093000000002,
        },
        {
          pinId: "C20.2",
          x: -2.31430995,
          y: -0.5512093000000002,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 1.7577928249999983,
        y: 1.7512907000000002,
      },
      width: 0.3155856499999966,
      height: 1.0583332999999997,
      pins: [
        {
          pinId: "R11.1",
          x: 1.7580660749999977,
          y: 2.3025814000000002,
        },
        {
          pinId: "R11.2",
          x: 1.757519574999999,
          y: 1.2,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["C20.1", "U3.8"],
      netId: "capacitor.C20 > port.pin1 to .U3 > .VDD",
    },
    {
      pinIds: ["C20.2", "U3.4"],
      netId: "capacitor.C20 > port.pin2 to .U3 > .GND",
    },
    {
      pinIds: ["R11.2", "U3.1"],
      netId: "resistor.R11 > port.pin2 to .U3 > .N_CS",
    },
  ],
  netConnections: [
    {
      netId: "V3_3",
      pinIds: ["U3.8", "U3.3", "U3.7", "C20.1", "R11.1"],
    },
    {
      netId: "GND",
      pinIds: ["U3.4", "C20.2"],
    },
    {
      netId: "FLASH_N_CS",
      pinIds: ["U3.1", "R11.2"],
    },
  ],
  availableNetLabelOrientations: {
    V3_3: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
} as InputProblem

test("example14", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
