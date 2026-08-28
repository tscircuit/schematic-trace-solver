import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("repro: facing terminal inline labels overlap on their preferred side", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "R1",
        center: { x: -1, y: 0 },
        width: 0.6,
        height: 0.3,
        pins: [{ pinId: "R1.2", x: -0.7, y: 0, _facingDirection: "x+" }],
      },
      {
        chipId: "R2",
        center: { x: 1, y: 0 },
        width: 0.6,
        height: 0.3,
        pins: [{ pinId: "R2.1", x: 0.7, y: 0, _facingDirection: "x-" }],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "R1_DISCH",
        pinIds: ["R1.2"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.9,
        inlineNetLabelHeight: 0.12,
      },
      {
        netId: "DISCH_R2",
        pinIds: ["R2.1"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.9,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: {
      R1_DISCH: ["x+"],
      DISCH_R2: ["x-"],
    },
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "R1_DISCH",
      netId: "R1_DISCH",
      mspConnectionPairIds: [],
      pinIds: ["R1.2"],
      orientation: "x+",
      anchorPoint: { x: -0.7, y: 0 },
      center: { x: -0.1, y: 0 },
      width: 0.9,
      height: 0.12,
    },
    {
      globalConnNetId: "DISCH_R2",
      netId: "DISCH_R2",
      mspConnectionPairIds: [],
      pinIds: ["R2.1"],
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

  const placements = solver.getOutput().inlineNetLabelPlacements
  expect(placements).toHaveLength(2)
  expect(placements.map((placement) => placement.side)).toEqual(["y+", "y+"])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
