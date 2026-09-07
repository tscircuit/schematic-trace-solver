import { expect, test } from "bun:test"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { boundsOverlap } from "lib/utils/textBoxBounds"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("moves a routed power label around fixed inline text without moving the wire", () => {
  const power: NetLabelPlacement = {
    netId: "POWER",
    globalConnNetId: "POWER",
    pinIds: ["P1", "P2"],
    mspConnectionPairIds: ["power-wire"],
    orientation: "y+",
    anchorPoint: { x: 1, y: 0 },
    center: { x: 1, y: 0.21 },
    width: 0.8,
    height: 0.42,
  }
  const fixed: NetLabelPlacement = {
    netId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    pinIds: ["S1"],
    mspConnectionPairIds: [],
    orientation: "y+",
    anchorPoint: { x: 1, y: 0.1 },
    center: { x: 1, y: 0.21 },
    width: 0.6,
    height: 0.12,
  }
  const trace: SolvedTracePath = {
    mspPairId: "power-wire",
    mspConnectionPairIds: ["power-wire"],
    dcConnNetId: "POWER",
    globalConnNetId: "POWER",
    pinIds: ["P1", "P2"],
    pins: [
      { pinId: "P1", chipId: "A", x: 0, y: 0 },
      { pinId: "P2", chipId: "B", x: 3, y: 0 },
    ],
    tracePath: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ],
  }
  const saved = structuredClone({ power, fixed, trace })
  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    traces: [trace],
    netLabelPlacements: [power],
    fixedNetLabelPlacements: [fixed],
    useRenderedLabelBounds: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const moved = solver.getOutput().netLabelPlacements[0]!
  expect(moved.anchorPoint).not.toEqual(power.anchorPoint)
  expect(
    boundsOverlap(getAnchoredNetLabelRenderedBounds(moved), {
      minX: 0.7,
      maxX: 1.3,
      minY: 0.15,
      maxY: 0.27,
    }),
  ).toBe(false)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(1)
  expect({ power, fixed, trace }).toEqual(saved)
})
