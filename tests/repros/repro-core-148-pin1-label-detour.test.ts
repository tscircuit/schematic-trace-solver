import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Captured from @tscircuit/core repro148. The generated GND label overlaps the
// initial U1.pin1 route, but avoiding it would add a visible four-point notch.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: 0 },
      width: 2.2,
      height: 1,
      pins: [
        { pinId: "schematic_port_0", x: -1.1, y: 0.3 },
        { pinId: "schematic_port_1", x: -1.1, y: 0.1 },
        { pinId: "schematic_port_2", x: -1.1, y: -0.1 },
        { pinId: "schematic_port_3", x: -1.1, y: -0.3 },
        { pinId: "schematic_port_4", x: 1.1, y: -0.3 },
        { pinId: "schematic_port_5", x: 1.1, y: -0.1 },
        { pinId: "schematic_port_6", x: 1.1, y: 0.1 },
        { pinId: "schematic_port_7", x: 1.1, y: 0.3 },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: { x: -0.7, y: 1.32 },
      width: 2.2,
      height: 0.4,
      pins: [
        { pinId: "schematic_port_8", x: 0.4, y: 1.32 },
        { pinId: "schematic_port_9", x: -1.8, y: 1.32 },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: { x: -2.1, y: 0.1 },
      width: 0.6,
      height: 0.84,
      pins: [
        { pinId: "schematic_port_10", x: -2.4, y: 0.1 },
        { pinId: "schematic_port_11", x: -1.8, y: 0.1 },
      ],
    },
  ],
  directConnections: [
    {
      netId: ".J1 > .pin1 to U1.pin1",
      pinIds: ["schematic_port_8", "schematic_port_0"],
    },
    {
      netId: ".J1 > .pin2 to U1.pin2",
      pinIds: ["schematic_port_9", "schematic_port_1"],
    },
    {
      netId: ".C1 > .pin1 to U1.pin3",
      pinIds: ["schematic_port_10", "schematic_port_2"],
    },
    {
      netId: ".C1 > .pin2 to U1.pin2",
      pinIds: ["schematic_port_11", "schematic_port_1"],
    },
  ],
  netConnections: [],
  textBoxes: [
    {
      chipId: "schematic_component_0",
      center: { x: -0.58, y: 0.615 },
      width: 0.36,
      height: 0.25,
      text: "U1",
    },
    {
      chipId: "schematic_component_1",
      center: { x: 0.12, y: 0.99 },
      width: 0.24,
      height: 0.18,
      text: "J1",
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2.4,
}

test("core repro148 keeps U1.pin1 on its shorter route", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const pin1Trace = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.find(
      (trace) => trace.mspPairId === "schematic_port_8-schematic_port_0",
    )

  expect(pin1Trace?.tracePath).toEqual([
    { x: 0.40000000000000036, y: 1.32 },
    { x: 1.3, y: 1.32 },
    { x: 1.3, y: -0.7 },
    { x: -1.6510000000000002, y: -0.7 },
    { x: -1.6510000000000002, y: 0.3 },
    { x: -1.1, y: 0.3 },
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
