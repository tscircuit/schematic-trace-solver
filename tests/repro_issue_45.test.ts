import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "../lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "../lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      pins: [
        { pinId: "U1.1", x: 1, y: 0.1 },
        { pinId: "U1.2", x: 1, y: -0.1 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1"],
    },
    {
      netId: "VCC",
      pinIds: ["U1.2"],
    },
  ],
  availableNetLabelOrientations: {
    GND: ["x+"],
    VCC: ["x+"],
  },
  maxMspPairDistance: 100,
}

test("repro_issue_45_label_collisions", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  const labels = solver.netLabelPlacementSolver!.netLabelPlacements

  expect(labels.length).toBe(2)

  // They should not collide.
  // If they both use x+ at (1, 0.1) and (1, -0.1), the height is 0.2.
  // Center 1: (1 + width/2, 0.1), bounds: [1, 1+width, 0, 0.2]
  // Center 2: (1 + width/2, -0.1), bounds: [1, 1+width, -0.2, 0]
  // They touch at y=0 but shouldn't overlap.

  console.log(
    `Labels: ${JSON.stringify(labels.map((l) => ({ netId: l.netId, center: l.center, width: l.width, height: l.height })))}`,
  )
})
