import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Captured from @tscircuit/core for a TYPE_C_16PIN_2MD chip whose pin 5 is
// connected directly to a resistor on the opposite side of the chip.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: 0 },
      width: 2.6,
      height: 1,
      pins: [
        {
          pinId: "schematic_port_0",
          x: -1.3,
          y: 0.30000000000000004,
        },
        {
          pinId: "schematic_port_1",
          x: -1.3,
          y: 0.10000000000000003,
        },
        {
          pinId: "schematic_port_2",
          x: -1.3,
          y: -0.09999999999999998,
        },
        {
          pinId: "schematic_port_3",
          x: -1.3,
          y: -0.30000000000000004,
        },
        {
          pinId: "schematic_port_4",
          x: 1.3,
          y: -0.30000000000000004,
        },
        {
          pinId: "schematic_port_5",
          x: 1.3,
          y: -0.10000000000000003,
        },
        {
          pinId: "schematic_port_6",
          x: 1.3,
          y: 0.09999999999999998,
        },
        {
          pinId: "schematic_port_7",
          x: 1.3,
          y: 0.30000000000000004,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: { x: -2, y: 0 },
      width: 0.6000000000000001,
      height: 0.6799999999999999,
      pins: [
        {
          pinId: "schematic_port_8",
          x: -2.3,
          y: 0,
        },
        {
          pinId: "schematic_port_9",
          x: -1.7,
          y: 0,
        },
      ],
    },
  ],
  directConnections: [
    {
      netId: ".U1 > .pin5 to R1.pin1",
      netLabelWidth: 0.96,
      pinIds: ["schematic_port_4", "schematic_port_8"],
    },
  ],
  netConnections: [],
  textBoxes: [
    {
      chipId: "schematic_component_0",
      center: { x: 0.06, y: -0.63 },
      width: 1.92,
      height: 0.17999999999999994,
      text: "TYPE_C_16PIN_2MD",
    },
    {
      chipId: "schematic_component_0",
      center: { x: -0.78, y: 0.615 },
      width: 0.3599999999999999,
      height: 0.25,
      text: "U1",
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2.4,
  _hideRatsNet: false,
}

test("TYPE_C_16PIN_2MD routes pin 5 to R1 below the MPN text", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const mpnTextBox = inputProblem.textBoxes![0]!
  const mpnBottom = mpnTextBox.center.y - mpnTextBox.height / 2

  expect(traces).toHaveLength(1)
  expect(
    Math.min(...traces[0]!.tracePath.map((point) => point.y)),
  ).toBeLessThan(mpnBottom)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
