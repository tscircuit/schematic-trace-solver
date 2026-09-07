import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { findLabelCollisions } from "tests/fixtures/findLabelCollisions"

test("flips text that would overlap a neighboring inline terminal wire", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U.1", x: 0.5, y: 0.1, _facingDirection: "x+" },
          { pinId: "U.2", x: 0.5, y: -0.1, _facingDirection: "x+" },
        ],
      },
    ],
    availableNetLabelOrientations: {},
    directConnections: [],
    netConnections: [
      {
        netId: "UPPER",
        pinIds: ["U.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 1.2,
        inlineNetLabelHeight: 0.18,
      },
      {
        netId: "LOWER",
        pinIds: ["U.2"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 1.2,
        inlineNetLabelHeight: 0.18,
      },
    ],
  }
  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: inputProblem.netConnections.map(
      (connection, index) => ({
        globalConnNetId: connection.netId,
        netId: connection.netId,
        pinIds: connection.pinIds,
        mspConnectionPairIds: [],
        orientation: "x+",
        anchorPoint: { x: 0.5, y: 0.1 - index * 0.2 },
        center: { x: 1.1, y: 0.1 - index * 0.2 },
        width: 1.2,
        height: 0.2,
      }),
    ),
  })
  solver.solve()
  const output = solver.getOutput()
  expect(output.inlineNetLabelPlacements).toHaveLength(2)
  expect(
    output.inlineNetLabelPlacements.find((label) => label.netId === "LOWER")
      ?.side,
  ).toBe("y-")
  expect(findLabelCollisions(output)).toEqual({
    labelPairs: [],
    traceLabels: [],
  })
})
