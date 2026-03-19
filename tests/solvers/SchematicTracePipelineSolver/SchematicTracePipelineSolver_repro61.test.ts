import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * Reproduces the bug from tscircuit/schematic-trace-solver#79:
 * Two capacitors connected ONLY via net labels (GND, VCC) should NOT
 * produce any MSP pairs or traces — only net labels.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1.0,
      pins: [
        { pinId: "C1.1", x: 2, y: 0.5 },
        { pinId: "C1.2", x: 2, y: -0.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1.0,
      pins: [
        { pinId: "C2.1", x: 0, y: 0.5 },
        { pinId: "C2.2", x: 0, y: -0.5 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "GND", pinIds: ["C1.1", "C2.1"] },
    { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
  ],
  availableNetLabelOrientations: {
    GND: ["y+"],
    VCC: ["y-"],
  },
}

test("repro61: net-label-only connections produce no traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)

  // No MSP pairs should be created for net-label-only connections
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs.length).toBe(0)

  // Net labels should still be placed
  expect(
    solver.netLabelPlacementSolver!.netLabelPlacements.length,
  ).toBeGreaterThan(0)
})
