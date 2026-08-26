import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getTextBoxBounds } from "lib/utils/textBoxBounds"
import "tests/fixtures/matcher"

// Reduced from the PMP11282 reproduction. U503.pin2 and TP502.pin1 are the
// original schematic_port_238 and schematic_port_273 endpoints.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U503",
      center: { x: -2.7375, y: -1.6425 },
      width: 2.1,
      height: 0.6,
      pins: [
        { pinId: "U503.pin1", x: -3.7875, y: -1.5425 },
        { pinId: "U503.pin2", x: -3.7875, y: -1.7425 },
        { pinId: "U503.pin3", x: -1.6875, y: -1.7425 },
        { pinId: "U503.pin4", x: -1.6875, y: -1.5425 },
      ],
    },
    {
      chipId: "TP502",
      center: { x: 0.17175, y: -2.0075 },
      width: 0.9625,
      height: 0.2,
      pins: [{ pinId: "TP502.pin1", x: -0.3095, y: -2.0075 }],
    },
  ],
  directConnections: [
    {
      netId: "TP502.pin1 to U503.pin2",
      pinIds: ["TP502.pin1", "U503.pin2"],
    },
  ],
  netConnections: [],
  textBoxes: [
    {
      chipId: "U503",
      center: { x: -2.6675, y: -2.0725 },
      width: 1.44,
      height: 0.18,
      text: "PC817X4NSZ0F",
    },
    {
      chipId: "U503",
      center: { x: -3.1475, y: -1.2275 },
      width: 0.6,
      height: 0.25,
      text: "U503",
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 100,
}

test("PMP11282 endpoint trace crosses U503 component text", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  const trace = solver.schematicTraceLinesSolver!.solvedTracePaths.find(
    (candidate) =>
      candidate.pinIds.includes("U503.pin2") &&
      candidate.pinIds.includes("TP502.pin1"),
  )
  const componentTextBox = inputProblem.textBoxes!.find(
    (textBox) => textBox.text === "PC817X4NSZ0F",
  )!

  expect(trace).toBeDefined()
  expect(
    isPathCollidingWithObstacles(trace!.tracePath, [
      getTextBoxBounds(componentTextBox),
    ]),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
