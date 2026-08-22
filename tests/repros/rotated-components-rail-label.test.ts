import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "D1",
      center: { x: 7.9, y: 0 },
      width: 0.7400000000000002,
      height: 1.04,
      pins: [
        { pinId: "D1.1", x: 8, y: -0.52 },
        { pinId: "D1.2", x: 8, y: 0.52 },
      ],
    },
    {
      chipId: "D2",
      center: { x: 10, y: 0.07 },
      width: 1.0399999999999991,
      height: 0.68,
      pins: [
        { pinId: "D2.1", x: 9.48, y: 0 },
        { pinId: "D2.2", x: 10.52, y: 0 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "VCC",
      pinIds: ["D1.1", "D2.1"],
      netLabelWidth: 0.48,
      netLabelHeight: 0.42,
    },
    {
      netId: "GND",
      pinIds: ["D1.2", "D2.2"],
      netLabelWidth: 0.48,
      netLabelHeight: 0.42,
    },
  ],
  textBoxes: [],
  availableNetLabelOrientations: {
    GND: ["y-"],
    VCC: ["y+"],
  },
  maxMspPairDistance: 0.1,
}

test("rotated component rail labels replace over-distance traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const gndLabels = labels.filter((label) => label.netId === "GND")

  expect(solver.longDistancePairSolver!.getOutput().newTraces).toHaveLength(0)
  expect(gndLabels.map((label) => label.pinIds)).toEqual([["D1.2"], ["D2.2"]])
  expect(gndLabels.every((label) => label.orientation === "y-")).toBe(true)
})
