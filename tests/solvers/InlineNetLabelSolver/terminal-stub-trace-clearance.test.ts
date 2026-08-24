import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("reproduces terminal inline-label stubs crossing an unrelated trace", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0.1 },
        width: 1,
        height: 0.8,
        pins: [
          { pinId: "U1.scl", x: 0.5, y: 0.3, _facingDirection: "x+" },
          { pinId: "U1.sda", x: 0.5, y: 0.1, _facingDirection: "x+" },
          { pinId: "U1.vcc", x: 0.5, y: -0.1, _facingDirection: "x+" },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "SCL",
        pinIds: ["U1.scl"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.3,
        inlineNetLabelHeight: 0.12,
      },
      {
        netId: "SDA",
        pinIds: ["U1.sda"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.3,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: {
      SCL: ["x+"],
      SDA: ["x+"],
    },
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "SCL",
      netId: "SCL",
      mspConnectionPairIds: [],
      pinIds: ["U1.scl"],
      orientation: "x+",
      anchorPoint: { x: 0.5, y: 0.3 },
      center: { x: 0.8, y: 0.3 },
      width: 0.3,
      height: 0.12,
    },
    {
      globalConnNetId: "SDA",
      netId: "SDA",
      mspConnectionPairIds: [],
      pinIds: ["U1.sda"],
      orientation: "x+",
      anchorPoint: { x: 0.5, y: 0.1 },
      center: { x: 0.8, y: 0.1 },
      width: 0.3,
      height: 0.12,
    },
  ]
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "available-net-orientation-VCC",
      dcConnNetId: "VCC",
      globalConnNetId: "VCC",
      pins: [] as any,
      tracePath: [
        { x: 0.5, y: -0.1 },
        { x: 1, y: -0.1 },
        { x: 1, y: 0.5 },
      ],
      mspConnectionPairIds: [],
      pinIds: ["U1.vcc"],
    },
  ]

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces,
    netLabelPlacements,
  })
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
