import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"

/**
 * Repro for issue #79: Two capacitors connected ONLY via net labels (GND, VCC)
 * should NOT produce traces between them. Net labels are the visual connection
 * representation — traces should only be drawn for directConnections.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 0, y: 0.5 },
        { pinId: "C1.2", x: 0, y: -0.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 2, y: 0.5 },
        { pinId: "C2.2", x: 2, y: -0.5 },
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
}

test("net-label-only connections should not produce traces (issue #79)", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // MspConnectionPairSolver should create NO pairs for net-label-only connections
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs.length).toBe(0)

  // No traces should be solved
  expect(solver.schematicTraceLinesSolver!.solvedTracePaths.length).toBe(0)

  // No long-distance traces either
  expect(solver.longDistancePairSolver!.solvedLongDistanceTraces.length).toBe(0)
})
