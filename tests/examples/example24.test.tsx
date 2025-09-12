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
      width: 2.4000000000000004,
      height: 1,
      pins: [
        {
          pinId: "U1.1",
          x: 1.2000000000000002,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.2",
          x: -1.2000000000000002,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.3",
          x: 1.2000000000000002,
          y: 0.09999999999999998,
        },
        {
          pinId: "U1.4",
          x: -1.2000000000000002,
          y: 0.30000000000000004,
        },
        {
          pinId: "U1.5",
          x: -1.2000000000000002,
          y: 0.10000000000000003,
        },
        {
          pinId: "U1.6",
          x: -1.2000000000000002,
          y: -0.09999999999999998,
        },
        {
          pinId: "U1.7",
          x: 1.2000000000000002,
          y: -0.10000000000000003,
        },
        {
          pinId: "U1.8",
          x: 1.2000000000000002,
          y: 0.30000000000000004,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 2.7,
        y: -2.0950000000000002, // Moved below component 0
      },
      width: 2.2,
      height: 0.8,
      pins: [
        {
          pinId: "J1.1",
          x: 1.6,
          y: -1.895, // Adjusted y position
        },
        {
          pinId: "J1.2",
          x: 1.6,
          y: -2.0950000000000002, // Adjusted y position
        },
        {
          pinId: "J1.3",
          x: 1.6,
          y: -2.295, // Adjusted y position
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1", "J1.3"], // U1.1 connects to J1.3
    },
    {
      netId: "VCC",
      pinIds: ["U1.8", "J1.1"], // U1.8 connects to J1.1
    },
    {
      netId: "MMM",
      pinIds: ["J1.2"], // U1.8 connects to J1.1
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y-"], // Changed to y- since trace now goes downward
    OUT: ["x-", "x+"],
    GND: ["y-"], // Changed to y- since trace now goes downward
    MMM: ["x+", "x-"],
  },
  maxMspPairDistance: 2.4,
} as InputProblem

test("example24", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
