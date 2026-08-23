import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("two-pin terminal stubs fall back atomically when one endpoint is obstructed", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: -2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U1.1", x: -1.5, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "U2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U2.1", x: 1.5, y: 0, _facingDirection: "x-" }],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "NET_SIGNAL",
        pinIds: ["U1.1", "U2.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 1.1,
        inlineNetLabelHeight: 0.12,
      },
    ],
    textBoxes: [
      {
        center: { x: -0.85, y: 0.11 },
        width: 1.1,
        height: 0.12,
        text: "obstacle",
      },
    ],
    availableNetLabelOrientations: { NET_SIGNAL: ["x-", "x+"] },
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "NET_SIGNAL",
      netId: "NET_SIGNAL",
      mspConnectionPairIds: [],
      pinIds: ["U1.1"],
      orientation: "x+",
      anchorPoint: { x: -1.5, y: 0 },
      center: { x: -0.9, y: 0 },
      width: 1.1,
      height: 0.12,
    },
    {
      globalConnNetId: "NET_SIGNAL",
      netId: "NET_SIGNAL",
      mspConnectionPairIds: [],
      pinIds: ["U2.1"],
      orientation: "x-",
      anchorPoint: { x: 1.5, y: 0 },
      center: { x: 0.9, y: 0 },
      width: 1.1,
      height: 0.12,
    },
  ]

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [],
    netLabelPlacements,
  })
  solver.solve()

  expect(solver.inlineNetLabelPlacements).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(2)
})
