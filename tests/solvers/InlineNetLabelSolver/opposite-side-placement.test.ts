import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("an inline label tries the opposite side when the preferred side is blocked", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: -2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U1.1", x: -1.5, y: 0 }],
      },
      {
        chipId: "U2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U2.1", x: 1.5, y: 0 }],
      },
    ],
    directConnections: [
      {
        netId: "SIGNAL",
        pinIds: ["U1.1", "U2.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.8,
        inlineNetLabelHeight: 0.12,
      },
    ],
    netConnections: [],
    textBoxes: [
      {
        center: { x: 0, y: 0.11 },
        width: 3,
        height: 0.12,
        text: "preferred-side obstacle",
      },
    ],
    availableNetLabelOrientations: { SIGNAL: ["x-", "x+"] },
  }
  const trace: SolvedTracePath = {
    mspPairId: "U1.1-U2.1",
    mspConnectionPairIds: ["U1.1-U2.1"],
    dcConnNetId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    userNetId: "SIGNAL",
    pins: [
      { pinId: "U1.1", chipId: "U1", x: -1.5, y: 0 },
      { pinId: "U2.1", chipId: "U2", x: 1.5, y: 0 },
    ],
    pinIds: ["U1.1", "U2.1"],
    tracePath: [
      { x: -1.5, y: 0 },
      { x: 1.5, y: 0 },
    ],
  }

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [trace],
    netLabelPlacements: [],
  })
  solver.solve()

  expect(solver.inlineNetLabelPlacements).toHaveLength(1)
  expect(solver.inlineNetLabelPlacements[0]!.side).toBe("y-")
  expect(solver.inlineNetLabelPlacements[0]!.center.y).toBeLessThan(0)
})

test("an inline label uses preferred side when no obstacle is present", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: -2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U1.1", x: -1.5, y: 0 }],
      },
      {
        chipId: "U2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U2.1", x: 1.5, y: 0 }],
      },
    ],
    directConnections: [
      {
        netId: "SIGNAL",
        pinIds: ["U1.1", "U2.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.8,
        inlineNetLabelHeight: 0.12,
      },
    ],
    netConnections: [],
    textBoxes: [],
    availableNetLabelOrientations: { SIGNAL: ["x-", "x+"] },
  }
  const trace: SolvedTracePath = {
    mspPairId: "U1.1-U2.1",
    mspConnectionPairIds: ["U1.1-U2.1"],
    dcConnNetId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    userNetId: "SIGNAL",
    pins: [
      { pinId: "U1.1", chipId: "U1", x: -1.5, y: 0 },
      { pinId: "U2.1", chipId: "U2", x: 1.5, y: 0 },
    ],
    pinIds: ["U1.1", "U2.1"],
    tracePath: [
      { x: -1.5, y: 0 },
      { x: 1.5, y: 0 },
    ],
  }

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [trace],
    netLabelPlacements: [],
  })
  solver.solve()

  expect(solver.inlineNetLabelPlacements).toHaveLength(1)
  expect(solver.inlineNetLabelPlacements[0]!.side).toBe("y+")
  expect(solver.inlineNetLabelPlacements[0]!.center.y).toBeGreaterThan(0)
})

