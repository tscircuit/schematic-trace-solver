import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const horizontalResistor = (name: string, x: number) => ({
  chipId: name,
  center: { x, y: 2 },
  width: 0.72,
  height: 0.68,
  pins: [
    {
      pinId: `${name}.1`,
      displayName: "1",
      x: x - 0.36,
      y: 2,
      _facingDirection: "x-" as const,
    },
    {
      pinId: `${name}.2`,
      displayName: "2",
      x: x + 0.36,
      y: 2,
      _facingDirection: "x+" as const,
    },
  ],
})

// Isolated from the TIDA-00553 battery-pack cell-count selector. R26-R29
// form the VFB divider, J4 pins 1/3/5 tap its intermediate nodes, and J4 pins
// 2/4/6 share the ground end of the divider.
const inputProblem: InputProblem = {
  chips: [
    horizontalResistor("R26", 7.2),
    horizontalResistor("R27", 8.2),
    horizontalResistor("R28", 9.2),
    horizontalResistor("R29", 10.2),
    {
      chipId: "J4",
      center: { x: 10.4, y: 0.6 },
      width: 1.6,
      height: 0.8,
      pins: [
        { pinId: "J4.1", displayName: "1", x: 9.6, y: 0.8 },
        { pinId: "J4.2", displayName: "2", x: 11.2, y: 0.8 },
        { pinId: "J4.3", displayName: "3", x: 9.6, y: 0.6 },
        { pinId: "J4.4", displayName: "4", x: 11.2, y: 0.6 },
        { pinId: "J4.5", displayName: "5", x: 9.6, y: 0.4 },
        { pinId: "J4.6", displayName: "6", x: 11.2, y: 0.4 },
      ],
    },
  ],
  directConnections: [
    {
      netId: "4-Cell/J4-R26",
      netLabelText: "J4_5",
      netLabelWidth: 0.6,
      pinIds: ["J4.5", "R26.2"],
    },
    { netId: "4-Cell/J4-R27", pinIds: ["J4.5", "R27.1"] },
    { netId: "3-Cell/J4-R27", pinIds: ["J4.3", "R27.2"] },
    { netId: "3-Cell/J4-R28", pinIds: ["J4.3", "R28.1"] },
    { netId: "2-Cell/J4-R28", pinIds: ["J4.1", "R28.2"] },
    { netId: "2-Cell/J4-R29", pinIds: ["J4.1", "R29.1"] },
  ],
  netConnections: [
    {
      netId: "U2_VFB",
      netLabelText: "U2_VFB",
      netLabelWidth: 1.12,
      pinIds: ["R26.1"],
    },
    {
      netId: "GND",
      netLabelText: "GND",
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: ["R29.2", "J4.2", "J4.4", "J4.6"],
    },
  ],
  textBoxes: [
    {
      chipId: "J4",
      center: { x: 10.12, y: 0.07 },
      width: 0.24,
      height: 0.18,
      text: "J4",
    },
    {
      chipId: "J4",
      center: { x: 10.12, y: 1.115 },
      width: 0.36,
      height: 0.25,
      text: "J4",
    },
  ],
  availableNetLabelOrientations: {
    U2_VFB: ["x-"],
    "4-Cell/J4-R26": ["x-"],
    "4-Cell/J4-R27": ["x-"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
}

test("repro TIDA-00553 J4 cell divider routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
