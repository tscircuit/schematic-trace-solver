import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"

test("prefers a clear detour over a shorter path through another label", () => {
  const trace: SolvedTracePath = {
    mspPairId: "rail",
    mspConnectionPairIds: ["rail"],
    globalConnNetId: "power",
    dcConnNetId: "power",
    pinIds: ["top", "bottom"],
    pins: [
      { pinId: "top", chipId: "U1", x: 0, y: 4 },
      { pinId: "bottom", chipId: "U1", x: 0, y: 0 },
    ],
    tracePath: [
      { x: 0, y: 4 },
      { x: -1, y: 4 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
    ],
  }
  const label: NetLabelPlacement = {
    globalConnNetId: "label",
    netId: "LABEL",
    mspConnectionPairIds: [],
    pinIds: [],
    orientation: "y+",
    anchorPoint: { x: -1.3, y: 1.8 },
    center: { x: -1.3, y: 2 },
    width: 0.8,
    height: 0.4,
  }
  const neighbor: NetLabelPlacement = {
    ...label,
    globalConnNetId: "neighbor",
    netId: "NEIGHBOR",
    anchorPoint: { x: -0.5, y: 1.8 },
    center: { x: -0.5, y: 2 },
    width: 0.6,
  }
  const solver = new SingleOverlapSolver({
    trace,
    label,
    problem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    netLabelPlacements: [label, neighbor],
    paddingBuffer: 0.1,
    detourCount: 0,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(
    detectTraceLabelOverlap({
      traces: [{ ...trace, tracePath: solver.solvedTracePath! }],
      netLabels: [label, neighbor],
    }),
  ).toHaveLength(0)
})
