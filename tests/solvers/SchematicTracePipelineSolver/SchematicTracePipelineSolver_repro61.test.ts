import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: 0, y: 0 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 0, y: 0.5, _facingDirection: "y+" },
        { pinId: "C1.2", x: 0, y: -0.5, _facingDirection: "y-" },
      ],
    },
    {
      chipId: "C2",
      center: { x: 1.5, y: 0 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 1.5, y: 0.5, _facingDirection: "y+" },
        { pinId: "C2.2", x: 1.5, y: -0.5, _facingDirection: "y-" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VCC", pinIds: ["C1.1", "C2.1"] },
    { netId: "GND", pinIds: ["C1.2", "C2.2"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 10,
}

test("SchematicTracePipelineSolver_repro61 uses net labels without extra traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs).toHaveLength(0)
  expect(
    solver.longDistancePairSolver!.getOutput().allTracesMerged,
  ).toHaveLength(0)
  expect(solver.netLabelPlacementSolver!.netLabelPlacements).toHaveLength(4)
  expect(
    solver
      .netLabelPlacementSolver!.netLabelPlacements.map(
        (label) => `${label.netId}:${label.pinIds[0]}`,
      )
      .sort(),
  ).toEqual(["GND:C1.2", "GND:C2.2", "VCC:C1.1", "VCC:C2.1"])
})
