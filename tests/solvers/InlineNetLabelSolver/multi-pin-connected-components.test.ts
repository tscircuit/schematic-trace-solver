import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("a multi-pin net labels routed and disconnected components inline", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "J1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "J1.1",
            x: -0.5,
            y: 0.2,
            _facingDirection: "x-",
          },
          {
            pinId: "J1.2",
            x: -0.5,
            y: -0.2,
            _facingDirection: "x-",
          },
        ],
      },
      {
        chipId: "U1",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "U1.1",
            x: 2.5,
            y: 0,
            _facingDirection: "x+",
          },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "MOTOR",
        pinIds: ["J1.1", "J1.2", "U1.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.6,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: { MOTOR: ["x-", "x+"] },
  }
  const shortConnectorTrace: SolvedTracePath = {
    mspPairId: "J1.1-J1.2",
    mspConnectionPairIds: ["J1.1-J1.2"],
    dcConnNetId: "MOTOR",
    globalConnNetId: "MOTOR",
    userNetId: "MOTOR",
    pins: [
      { pinId: "J1.1", chipId: "J1", x: -0.5, y: 0.2 },
      { pinId: "J1.2", chipId: "J1", x: -0.5, y: -0.2 },
    ],
    pinIds: ["J1.1", "J1.2"],
    tracePath: [
      { x: -0.5, y: 0.2 },
      { x: -0.8, y: 0.2 },
      { x: -0.8, y: -0.2 },
      { x: -0.5, y: -0.2 },
    ],
  }

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [shortConnectorTrace],
    netLabelPlacements: [],
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.inlineNetLabelPlacements).toHaveLength(3)
  expect(
    output.inlineNetLabelPlacements.every(
      (placement) => placement.stubTracePath !== undefined,
    ),
  ).toBe(true)
  expect(output.traces).toHaveLength(0)
  expect(output.netLabelPlacements).toHaveLength(0)
})

test("a short routed component is retained when replacing it would strand an intermediate pin", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "J1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "J1.1", x: -0.5, y: 0.2, _facingDirection: "x-" },
          { pinId: "J1.2", x: -0.5, y: -0.2, _facingDirection: "x-" },
        ],
      },
      {
        chipId: "U1",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U1.1", x: 2.5, y: 0, _facingDirection: "x+" }],
      },
    ],
    directConnections: [{ pinIds: ["J1.1", "J1.2"] }],
    netConnections: [
      {
        netId: "MOTOR",
        pinIds: ["J1.1", "U1.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.6,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: { MOTOR: ["x-", "x+"] },
  }
  const shortTrace: SolvedTracePath = {
    mspPairId: "J1.1-J1.2",
    mspConnectionPairIds: ["J1.1-J1.2"],
    dcConnNetId: "MOTOR",
    globalConnNetId: "MOTOR",
    userNetId: "MOTOR",
    pins: [
      { pinId: "J1.1", chipId: "J1", x: -0.5, y: 0.2 },
      { pinId: "J1.2", chipId: "J1", x: -0.5, y: -0.2 },
    ],
    pinIds: ["J1.1", "J1.2"],
    tracePath: [
      { x: -0.5, y: 0.2 },
      { x: -0.8, y: 0.2 },
      { x: -0.8, y: -0.2 },
      { x: -0.5, y: -0.2 },
    ],
  }
  const anchoredLabels: NetLabelPlacement[] = [
    {
      globalConnNetId: "MOTOR",
      netId: "MOTOR",
      mspConnectionPairIds: ["J1.1-J1.2"],
      pinIds: ["J1.1", "J1.2"],
      orientation: "x-",
      anchorPoint: { x: -0.8, y: 0 },
      center: { x: -1.2, y: 0 },
      width: 0.6,
      height: 0.12,
    },
    {
      globalConnNetId: "MOTOR",
      netId: "MOTOR",
      mspConnectionPairIds: [],
      pinIds: ["U1.1"],
      orientation: "x+",
      anchorPoint: { x: 2.5, y: 0 },
      center: { x: 2.9, y: 0 },
      width: 0.6,
      height: 0.12,
    },
  ]

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [shortTrace],
    netLabelPlacements: anchoredLabels,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.inlineNetLabelPlacements).toHaveLength(0)
  expect(output.traces).toEqual([shortTrace])
  expect(output.netLabelPlacements).toEqual(anchoredLabels)
})
