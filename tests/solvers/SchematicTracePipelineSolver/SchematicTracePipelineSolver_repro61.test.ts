import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * Repro for issue #79: pins connected only via net labels (netConnections) should
 * not produce routed traces — only net-label annotations.
 *
 * Circuit: two decoupling capacitors, C1 and C2. Their positive pins are both on
 * VCC and their negative pins are both on GND. There are no direct wire
 * connections (directConnections is empty). The solver should place net labels
 * for VCC and GND but must NOT draw any MSP trace pairs between the pins.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: -1, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: -1, y: 0.5 },
        { pinId: "C1.2", x: -1, y: -0.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 1, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 1, y: 0.5 },
        { pinId: "C2.2", x: 1, y: -0.5 },
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

test("SchematicTracePipelineSolver_repro61: net-label-only connections produce no traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // No traces should be drawn — connections are only via net labels
  expect(
    solver.mspConnectionPairSolver!.mspConnectionPairs.length,
  ).toBe(0)

  // Net labels should still be placed (at least one for VCC and one for GND)
  expect(
    solver.netLabelPlacementSolver!.netLabelPlacements.length,
  ).toBeGreaterThanOrEqual(2)
})
