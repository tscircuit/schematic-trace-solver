import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("moves a power label along its trace without flipping its required orientation", async () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: -2, y: -0.5 },
        width: 0.4,
        height: 0.8,
        pins: [{ pinId: "U1.1", displayName: "VDD", x: -2, y: 0 }],
      },
      {
        chipId: "U2",
        center: { x: 2, y: -0.5 },
        width: 0.4,
        height: 0.8,
        pins: [{ pinId: "U2.1", displayName: "VDD", x: 2, y: 0 }],
      },
    ],
    directConnections: [],
    netConnections: [{ netId: "V1V1", pinIds: ["U1.1", "U2.1"] }],
    availableNetLabelOrientations: { V1V1: ["y+"] },
  }
  const trace: SolvedTracePath = {
    mspPairId: "U1.1-U2.1",
    globalConnNetId: "power-connectivity",
    dcConnNetId: "power-connectivity",
    userNetId: "V1V1",
    pins: [
      { ...inputProblem.chips[0]!.pins[0]!, chipId: "U1" },
      { ...inputProblem.chips[1]!.pins[0]!, chipId: "U2" },
    ],
    pinIds: ["U1.1", "U2.1"],
    mspConnectionPairIds: ["U1.1-U2.1"],
    tracePath: [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
    ],
  }
  const powerLabel: NetLabelPlacement = {
    globalConnNetId: trace.globalConnNetId,
    // Resolve the constraint through the connected pins, even without netId.
    netLabelText: "V1V1",
    pinIds: trace.pinIds,
    mspConnectionPairIds: [trace.mspPairId],
    orientation: "y+",
    anchorPoint: { x: -2, y: 0 },
    center: { x: -2, y: 0.2 },
    width: 0.6,
    height: 0.4,
  }
  const obstacle: NetLabelPlacement = {
    globalConnNetId: "signal-connectivity",
    netLabelText: "BLOCKED",
    pinIds: [],
    mspConnectionPairIds: [],
    orientation: "x+",
    anchorPoint: { x: -3, y: 0.2 },
    center: { x: -2, y: 0.2 },
    width: 2,
    height: 0.4,
  }
  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem,
    traces: [trace],
    netLabelPlacements: [powerLabel],
    fixedNetLabelPlacements: [obstacle],
  })
  solver.solve()

  const placedLabel = solver.getOutput().netLabelPlacements[0]!
  expect(placedLabel.orientation).toBe("y+")
  expect(
    placedLabel.anchorPoint.x - placedLabel.width / 2,
  ).toBeGreaterThanOrEqual(-1)
  expect(placedLabel.anchorPoint.y).toBe(0)
  const nearbyPlacements = solver.getNearbyValidPlacements(powerLabel, 4)
  expect(nearbyPlacements.length).toBeGreaterThan(0)
  expect(nearbyPlacements.every((label) => label.orientation === "y+")).toBe(
    true,
  )
  const graphics = solver.visualize()
  graphics.rects!.push({
    center: obstacle.center,
    width: obstacle.width,
    height: obstacle.height,
    fill: "rgba(255, 0, 0, 0.15)",
    stroke: "red",
    label: "Fixed signal label",
  })
  await expect(
    getSvgFromGraphicsObject(graphics, { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
