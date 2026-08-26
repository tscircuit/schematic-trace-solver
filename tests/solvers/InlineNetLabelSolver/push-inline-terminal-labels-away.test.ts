import { expect, test } from "bun:test"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { pushInlineTerminalLabelsAwayFromAnchoredLabels } from "lib/solvers/InlineNetLabelSolver/pushInlineTerminalLabelsAwayFromAnchoredLabels"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("moves an inline terminal row outward past a retained anchored label", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "J1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "J1.A0", x: -0.5, y: 0.2, _facingDirection: "x-" },
          { pinId: "J1.SCLK", x: -0.5, y: 0, _facingDirection: "x-" },
          { pinId: "J1.MISO", x: -0.5, y: -0.2, _facingDirection: "x-" },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const anchoredNetLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "A0",
      netId: "A0",
      mspConnectionPairIds: [],
      pinIds: ["J1.A0"],
      orientation: "x-",
      anchorPoint: { x: -0.5, y: 0.2 },
      center: { x: -0.75, y: 0.2 },
      width: 0.5,
      height: 0.2,
    },
  ]
  const inlineNetLabelPlacements: InlineNetLabelPlacement[] = [
    {
      globalConnNetId: "SCLK",
      netId: "SCLK",
      pinIds: ["J1.SCLK"],
      stubTracePath: [
        { x: -0.5, y: 0 },
        { x: -1.1, y: 0 },
      ],
      axis: "x",
      anchorPoint: { x: -0.8, y: 0 },
      center: { x: -0.8, y: 0.11 },
      width: 0.4,
      height: 0.12,
      side: "y+",
    },
    {
      globalConnNetId: "MISO",
      netId: "MISO",
      pinIds: ["J1.MISO"],
      stubTracePath: [
        { x: -0.5, y: -0.2 },
        { x: -1.1, y: -0.2 },
      ],
      axis: "x",
      anchorPoint: { x: -0.8, y: -0.2 },
      center: { x: -0.8, y: -0.09 },
      width: 0.4,
      height: 0.12,
      side: "y+",
    },
  ]

  const output = pushInlineTerminalLabelsAwayFromAnchoredLabels({
    inputProblem,
    traces: [],
    anchoredNetLabelPlacements,
    inlineNetLabelPlacements,
  })

  expect(output.movedGroupCount).toBe(1)
  expect(output.inlineNetLabelPlacements[0]!.center.x).toBeLessThan(-0.8)
  expect(output.inlineNetLabelPlacements[1]!.center.x).toBe(
    output.inlineNetLabelPlacements[0]!.center.x,
  )
  expect(output.inlineNetLabelPlacements[0]!.stubTracePath![0]).toEqual({
    x: -0.5,
    y: 0,
  })
  expect(output.inlineNetLabelPlacements[0]!.stubTracePath![1]!.x).toBeLessThan(
    -1.1,
  )
})
