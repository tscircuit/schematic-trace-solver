import { test, expect } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import { SchematicTracePipelineSolver } from "lib/index"
import "tests/fixtures/matcher"

// Repro: netlabel overlaps a non-matching trace segment; solver should move trace out of the way.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "U1.1", x: -1, y: 0 },
        { pinId: "U1.2", x: 1, y: 0 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 0, y: 2 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "U2.1", x: -1, y: 2 },
        { pinId: "U2.2", x: 1, y: 2 },
      ],
    },
  ],
  // Two nets: NET_A is horizontal across y=0, NET_B is a labeled net with y- orientation near the middle.
  directConnections: [
    { pinIds: ["U1.1", "U1.2"], netId: "NET_A" },
  ],
  netConnections: [
    { netId: "NET_B", pinIds: ["U2.1", "U2.2"], netLabelWidth: 0.45 },
  ],
  availableNetLabelOrientations: {
    NET_A: ["y+", "y-"],
    NET_B: ["y-"],
  },
  maxMspPairDistance: 5,
}

test("TraceLabelOverlapAvoidanceSolver moves trace away from netlabel", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Snapshot of the final phase should reflect that traces avoid labels
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
