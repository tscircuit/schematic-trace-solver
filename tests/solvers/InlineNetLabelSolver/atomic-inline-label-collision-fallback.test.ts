import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("an atomic terminal-label pair falls back when its labels overlap", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: -1, y: 0 },
        width: 0.6,
        height: 0.3,
        pins: [{ pinId: "U1.1", x: -0.7, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "U2",
        center: { x: 1, y: 0 },
        width: 0.6,
        height: 0.3,
        pins: [{ pinId: "U2.1", x: 0.7, y: 0, _facingDirection: "x-" }],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "SIGNAL",
        pinIds: ["U1.1", "U2.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.9,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: { SIGNAL: ["x+", "x-"] },
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "SIGNAL",
      netId: "SIGNAL",
      mspConnectionPairIds: [],
      pinIds: ["U1.1"],
      orientation: "x+",
      anchorPoint: { x: -0.7, y: 0 },
      center: { x: -0.1, y: 0 },
      width: 0.9,
      height: 0.12,
    },
    {
      globalConnNetId: "SIGNAL",
      netId: "SIGNAL",
      mspConnectionPairIds: [],
      pinIds: ["U2.1"],
      orientation: "x-",
      anchorPoint: { x: 0.7, y: 0 },
      center: { x: 0.1, y: 0 },
      width: 0.9,
      height: 0.12,
    },
  ]

  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [],
    netLabelPlacements,
  })
  solver.solve()

  expect(solver.getOutput().inlineNetLabelPlacements).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
