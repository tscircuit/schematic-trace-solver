import { expect, test } from "bun:test"
import { alignPortOnlyInlineNetLabelStubs } from "lib/solvers/InlineNetLabelSolver/alignPortOnlyInlineNetLabelStubs"
import type { InlineNetLabelPlacement } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("port stub row alignment is atomic when an extension would collide", () => {
  const placements: InlineNetLabelPlacement[] = [
    {
      globalConnNetId: "net-long",
      netId: "LONG_SIGNAL_NAME",
      pinIds: ["U1.1"],
      stubTracePath: [
        { x: -0.5, y: 0.3 },
        { x: -2.5, y: 0.3 },
      ],
      axis: "x",
      anchorPoint: { x: -1.5, y: 0.3 },
      center: { x: -1.5, y: 0.41 },
      width: 1.8,
      height: 0.12,
      side: "y+",
    },
    {
      globalConnNetId: "net-short",
      netId: "SHORT",
      pinIds: ["U1.2"],
      stubTracePath: [
        { x: -0.5, y: -0.3 },
        { x: -1.3, y: -0.3 },
      ],
      axis: "x",
      anchorPoint: { x: -0.9, y: -0.3 },
      center: { x: -0.9, y: -0.19 },
      width: 0.6,
      height: 0.12,
      side: "y+",
    },
  ]
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0.3 },
          { pinId: "U1.2", x: -0.5, y: -0.3 },
        ],
      },
      {
        chipId: "obstacle",
        center: { x: -1.8, y: -0.3 },
        width: 0.3,
        height: 0.2,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const aligned = alignPortOnlyInlineNetLabelStubs({
    placements,
    inputProblem,
    traces: [],
    netLabelPlacements: [],
  })

  expect(aligned[0]!.stubTracePath![1]!.x).toBe(-2.5)
  // The short row stays unchanged because extending the group to x=-2.5
  // would run this stub through the obstacle.
  expect(aligned[1]!.stubTracePath![1]!.x).toBe(-1.3)
})
