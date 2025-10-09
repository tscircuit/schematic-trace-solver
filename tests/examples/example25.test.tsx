import { expect } from "bun:test"
import { test } from "bun:test"
import { SchematicTracePipelineSolver, type InputProblem } from "lib/index"
import "tests/fixtures/matcher"

const inputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -3,
        y: 0,
      },
      width: 2.4000000000000004,
      height: 1,
      pins: [
        {
          pinId: "U1.1",
          x: -1.8,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.2",
          x: -4.2,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.3",
          x: -1.8,
          y: 0.09999999999999998,
        },
        {
          pinId: "U1.4",
          x: -4.2,
          y: 0.30000000000000004,
        },
        {
          pinId: "U1.5",
          x: -4.2,
          y: 0.10000000000000003,
        },
        {
          pinId: "U1.6",
          x: -4.2,
          y: -0.09999999999999998,
        },
        {
          pinId: "U1.7",
          x: -1.8,
          y: -0.10000000000000003,
        },
        {
          pinId: "U1.8",
          x: -1.8,
          y: 0.30000000000000004,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 3,
        y: 0,
      },
      width: 2.2,
      height: 0.8,
      pins: [
        {
          pinId: "J1.1",
          x: 1.9,
          y: 0.2,
        },
        {
          pinId: "J1.2",
          x: 1.9,
          y: 0,
        },
        {
          pinId: "J1.3",
          x: 1.9,
          y: -0.2,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 0,
        y: -2, // Moved down so component body doesn't block horizontal traces
      },
      width: 1.2,
      height: 3,
      pins: [
        {
          pinId: "U2.1",
          x: -0.4,
          y: -0.5, // Top pin
        },
        {
          pinId: "U2.2",
          x: 0.4,
          y: -0.6,
        },
        {
          pinId: "U2.3",
          x: -0.4,
          y: -2.8, // Bottom pin
        },
        {
          pinId: "U2.4",
          x: 0.4,
          y: -2.8,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "J1.3"],
    },
    {
      pinIds: ["U1.8", "J1.1"],
    },
  ],
  netConnections: [
    {
      netId: "SIGNAL1",
      pinIds: ["U2.2"],
    },
    {
      netId: "SIGNAL2",
      pinIds: ["U2.1"],
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 6.5,
} as InputProblem

test("example25", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
