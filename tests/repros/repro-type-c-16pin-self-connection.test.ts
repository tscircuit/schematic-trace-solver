import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Captured from @tscircuit/core for a TYPE_C_16PIN_2MD chip whose pin 4 is
// connected directly to pin 5 on the same schematic component.
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
  ],
  directConnections: [
    {
      netId: ".U1 > .pin4 to U1.pin5",
      netLabelWidth: 0.96,
      pinIds: ["schematic_port_3", "schematic_port_4"],
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

test("TYPE_C_16PIN_2MD routes pin 4 to pin 5 on the same chip", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.netLabelTraceCollisionSolver!.getOutput().traces).toHaveLength(
    1,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
