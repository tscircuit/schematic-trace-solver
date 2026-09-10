import { expect, test } from "bun:test"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("places a horizontal signal label past the trace endpoint without covering its host wire", () => {
  const trace: SolvedTracePath = {
    mspPairId: "U1.1-U2.1",
    globalConnNetId: "signal-connectivity",
    dcConnNetId: "signal-connectivity",
    userNetId: "SIGNAL",
    pins: [
      { chipId: "U1", pinId: "U1.1", x: 0, y: 0 },
      { chipId: "U2", pinId: "U2.1", x: 2, y: 0 },
    ],
    pinIds: ["U1.1", "U2.1"],
    mspConnectionPairIds: ["U1.1-U2.1"],
    tracePath: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
  }
  const label: NetLabelPlacement = {
    netId: "SIGNAL",
    globalConnNetId: trace.globalConnNetId,
    pinIds: trace.pinIds,
    mspConnectionPairIds: [trace.mspPairId],
    orientation: "x+",
    anchorPoint: { x: 0, y: 0 },
    center: { x: 0.5, y: 0 },
    width: 1,
    height: 0.2,
  }
  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: { SIGNAL: ["x+"] },
    },
    traces: [trace],
    netLabelPlacements: [label],
    fixedNetLabelPlacements: [{ ...label, globalConnNetId: "obstacle" }],
  })
  solver.solve()

  const placed = solver.getOutput().netLabelPlacements[0]!
  expect(placed.orientation).toBe("x+")
  expect(placed.anchorPoint).toEqual({ x: 2, y: 0 })
  expect(placed.center.x - placed.width / 2).toBeGreaterThan(2)
})
