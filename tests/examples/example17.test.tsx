import { expect } from "bun:test"
import { test } from "bun:test"
import { SchematicTracePipelineSolver, type InputProblem } from "lib/index"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 2.3,
      height: 1,
      pins: [
        {
          pinId: "U1.1",
          x: -1.15,
          y: 0.30000000000000004,
        },
        {
          pinId: "U1.2",
          x: -1.15,
          y: 0.10000000000000003,
        },
        {
          pinId: "U1.3",
          x: -1.15,
          y: -0.09999999999999998,
        },
        {
          pinId: "U1.4",
          x: -1.15,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.5",
          x: 1.15,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.6",
          x: 1.15,
          y: -0.10000000000000003,
        },
        {
          pinId: "U1.7",
          x: 1.15,
          y: 0.09999999999999998,
        },
        {
          pinId: "U1.8",
          x: 1.15,
          y: 0.30000000000000004,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -1.1500000000000004,
        y: 1.6700000000000002,
      },
      width: 1.04,
      height: 1.0400000000000005,
      pins: [
        {
          pinId: "D1.1",
          x: -1.1500000000000004,
          y: 1.15,
        },
        {
          pinId: "D1.2",
          x: -1.1500000000000004,
          y: 2.1900000000000004,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: -2.37,
        y: 0.10000000000000009,
      },
      width: 1.04,
      height: 0.54,
      pins: [
        {
          pinId: "D2.1",
          x: -1.85,
          y: 0.10000000000000002,
        },
        {
          pinId: "D2.2",
          x: -2.89,
          y: 0.10000000000000016,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: 2.4,
        y: -0.3000000000000007,
      },
      width: 1.1000000000000005,
      height: 0.84,
      pins: [
        {
          pinId: "C1.1",
          x: 1.8499999999999996,
          y: -0.3000000000000007,
        },
        {
          pinId: "C1.2",
          x: 2.95,
          y: -0.3000000000000007,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 4.2,
        y: -0.3000000000000007,
      },
      width: 1.0999999999999996,
      height: 0.84,
      pins: [
        {
          pinId: "C2.1",
          x: 3.6500000000000004,
          y: -0.3000000000000007,
        },
        {
          pinId: "C2.2",
          x: 4.75,
          y: -0.3000000000000007,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.5", "C1.1"],
      netId: ".U1 .VCC to .C1 .pin1",
    },
    {
      pinIds: ["C1.2", "C2.1"],
      netId: ".C1 .pin2 to .C2 .pin1",
    },
    {
      pinIds: ["U1.1", "D1.1"],
      netId: ".U1 .OUT1 to .D1 .pin1",
    },
    {
      pinIds: ["U1.2", "D2.1"],
      netId: ".U1 .OUT2 to .D2 .pin1",
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2.4,
}

test("example17", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})