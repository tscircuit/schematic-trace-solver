import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("terminal inline-label stubs trim only their free wire tail before non-owner chips and text boxes", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U2",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U2.dp", x: -0.5, y: 0.1, _facingDirection: "x-" },
          { pinId: "U2.dm", x: -0.5, y: -0.1, _facingDirection: "x-" },
        ],
      },
      {
        chipId: "C1",
        center: { x: -1.75, y: 0 },
        width: 1.16,
        height: 0.76,
        pins: [
          { pinId: "C1.1", x: -1.75, y: 0.38, _facingDirection: "y+" },
          { pinId: "C1.2", x: -1.75, y: -0.38, _facingDirection: "y-" },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "USB_DP",
        pinIds: ["U2.dp"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.56,
        inlineNetLabelHeight: 0.12,
      },
      {
        netId: "USB_DM",
        pinIds: ["U2.dm"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.56,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: {
      USB_DP: ["x-"],
      USB_DM: ["x-"],
    },
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "USB_DP",
      netId: "USB_DP",
      mspConnectionPairIds: [],
      pinIds: ["U2.dp"],
      orientation: "x-",
      anchorPoint: { x: -0.5, y: 0.1 },
      center: { x: -0.78, y: 0.1 },
      width: 0.56,
      height: 0.12,
    },
    {
      globalConnNetId: "USB_DM",
      netId: "USB_DM",
      mspConnectionPairIds: [],
      pinIds: ["U2.dm"],
      orientation: "x-",
      anchorPoint: { x: -0.5, y: -0.1 },
      center: { x: -0.78, y: -0.1 },
      width: 0.56,
      height: 0.12,
    },
  ]

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [],
    netLabelPlacements,
  })
  solver.solve()

  const placements = solver.getOutput().inlineNetLabelPlacements
  expect(placements).toHaveLength(2)
  const capacitorRightEdge = -1.75 + 1.16 / 2
  for (const placement of placements) {
    const [start, end] = placement.stubTracePath!
    expect(start.x).toBeCloseTo(-0.5)
    expect(end.x).toBeGreaterThan(capacitorRightEdge)
    expect(end.x).toBeLessThanOrEqual(placement.center.x - placement.width / 2)
  }
})
