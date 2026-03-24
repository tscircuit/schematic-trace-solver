import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * Repro for issue #79: two capacitors connected only via net labels (VCC, GND).
 * No direct connections exist, so the solver should NOT produce any traces.
 * Each pin should only receive a net label, with no trace drawn between them.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 2, y: 0.5 },
        { pinId: "C1.2", x: 2, y: -0.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
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
  availableNetLabelOrientations: {},
}

test("repro61: net-label-only connections should not produce traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  // No MSP pairs should be created for net-label-only connections
  const mspPairs = solver.mspConnectionPairSolver!.mspConnectionPairs
  expect(mspPairs).toHaveLength(0)

  // Net labels should still be placed for each net
  const labels = solver.netLabelPlacementSolver!.netLabelPlacements
  expect(labels.length).toBeGreaterThanOrEqual(2)

  // Each net should have labels
  const netIds = labels.map((l) => l.netId)
  expect(netIds).toContain("GND")
  expect(netIds).toContain("VCC")
})