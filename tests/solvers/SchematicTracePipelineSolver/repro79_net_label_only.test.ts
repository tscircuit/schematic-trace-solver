import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { test, expect } from "bun:test"

test("pins connected only via netConnections should not generate trace lines", () => {
  // Two components connected only via a net label — no direct wire between them.
  // The bug caused netConnMap mutations to bleed into directConnMap, making
  // queuedDcNetIds contain nets that only have net-label connections, resulting
  // in spurious schematic trace lines.
  const input = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0 },
        ],
      },
      {
        chipId: "U2",
        center: { x: 4, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U2.1", x: 3.5, y: 0 },
        ],
      },
    ],
    // No direct connections between these two chips
    directConnections: [],
    // Only connected via net label
    netConnections: [
      {
        netId: "VCC",
        pinIds: ["U1.1", "U2.1"],
      },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
    },
    maxMspPairDistance: 10,
  }

  const solver = new SchematicTracePipelineSolver(input as any)
  solver.solve()

  // No MSP connection pairs should be generated since there are no direct connections
  expect(solver.mspConnectionPairSolver?.mspConnectionPairs ?? []).toHaveLength(0)
})
