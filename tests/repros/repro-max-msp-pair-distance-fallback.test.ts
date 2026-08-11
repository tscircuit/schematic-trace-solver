import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -3, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: -2.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "U2",
      center: { x: 3, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 2.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "SIGNAL",
      pinIds: ["U1.1", "U2.1"],
      netLabelWidth: 0.72,
      netLabelHeight: 0.42,
    },
  ],
  availableNetLabelOrientations: {
    SIGNAL: ["x+", "x-"],
  },
  maxMspPairDistance: 2,
}

test("named connections beyond maxMspPairDistance fall back to net labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  expect(labels).toHaveLength(2)
})
