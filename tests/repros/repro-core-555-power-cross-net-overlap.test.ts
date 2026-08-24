import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Reduced from @tscircuit/core's schematic-section-2 fixture. The BTN_IN trace
// crosses the GND trace immediately below SW1.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: -4, y: 3 },
      width: 1,
      height: 0.65,
      pins: [
        {
          pinId: "schematic_port_0",
          x: -4.5,
          y: 3,
          _facingDirection: "x-",
        },
        {
          pinId: "schematic_port_1",
          x: -3.5,
          y: 3,
          _facingDirection: "x+",
        },
      ],
      sectionId: "power",
    },
    {
      chipId: "schematic_component_1",
      center: { x: -2, y: 3 },
      width: 0.76,
      height: 0.5,
      pins: [
        {
          pinId: "schematic_port_2",
          x: -2.38,
          y: 3,
          _facingDirection: "x-",
        },
        {
          pinId: "schematic_port_3",
          x: -1.62,
          y: 3,
          _facingDirection: "x+",
        },
      ],
      sectionId: "power",
    },
    {
      chipId: "schematic_component_2",
      center: { x: -3, y: 1.5 },
      width: 0.6,
      height: 0.84,
      pins: [
        {
          pinId: "schematic_port_4",
          x: -3.3,
          y: 1.5,
          _facingDirection: "x-",
        },
        {
          pinId: "schematic_port_5",
          x: -2.7,
          y: 1.5,
          _facingDirection: "x+",
        },
      ],
      sectionId: "power",
    },
  ],
  directConnections: [
    {
      netId: ".B1 > .pin1 to .SW1 > .pin1",
      allowInlineNetLabel: true,
      inlineNetLabelHeight: 0.12,
      inlineNetLabelWidth: 0.56,
      pinIds: ["schematic_port_0", "schematic_port_2"],
    },
  ],
  netConnections: [
    {
      netId: "GND",
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: ["schematic_port_1", "schematic_port_5"],
    },
    {
      netId: "VCC",
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: ["schematic_port_3", "schematic_port_4"],
    },
  ],
  textBoxes: [],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
  _hideRatsNet: false,
}

test("core 555 power section cross-net overlap below SW1", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
