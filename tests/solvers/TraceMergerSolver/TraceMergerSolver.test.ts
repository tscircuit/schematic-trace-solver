import { test, expect } from "bun:test"
import { TraceMergerSolver } from "lib/solvers/TraceMergerSolver/TraceMergerSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import "tests/fixtures/matcher"

test("TraceMergerSolver merges same-net traces that are close together", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "chip1",
        center: { x: -2, y: 0 },
        width: 1,
        height: 2,
        pins: [
          { pinId: "pin1", x: -1.5, y: 0.5 },
          { pinId: "pin2", x: -1.5, y: -0.5 },
        ],
      },
      {
        chipId: "chip2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 2,
        pins: [
          { pinId: "pin3", x: 1.5, y: 0.5 },
          { pinId: "pin4", x: 1.5, y: -0.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "net1",
        pinIds: ["pin1", "pin2", "pin3", "pin4"],
      },
    ],
    availableNetLabelOrientations: {},
  }

  // Create two parallel horizontal traces that should be merged
  // These traces are on the same net and their endpoints are very close
  const inputTraceMap: Record<string, SolvedTracePath> = {
    pair1: {
      mspPairId: "pair1",
      mspConnectionPairIds: ["mspPair1"],
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      pinIds: ["pin1", "pin3"],
      pins: [
        { pinId: "pin1", x: -1.5, y: 0.5, chipId: "chip1" },
        { pinId: "pin3", x: 1.5, y: 0.5, chipId: "chip2" },
      ],
      tracePath: [
        { x: -1.5, y: 0.5 },
        { x: -0.5, y: 0.5 },
        { x: -0.5, y: 0.05 }, // Goes down to y=0.05
        { x: 0, y: 0.05 }, // Continues at y=0.05
      ],
    },
    pair2: {
      mspPairId: "pair2",
      mspConnectionPairIds: ["mspPair2"],
      globalConnNetId: "net1", // Same net as pair1
      dcConnNetId: "net1",
      pinIds: ["pin2", "pin4"],
      pins: [
        { pinId: "pin2", x: -1.5, y: -0.5, chipId: "chip1" },
        { pinId: "pin4", x: 1.5, y: -0.5, chipId: "chip2" },
      ],
      tracePath: [
        { x: 0, y: 0.05 }, // Starts where pair1 ended (can merge!)
        { x: 0.5, y: 0.05 }, // Continues at y=0.05
        { x: 0.5, y: 0.5 }, // Goes up
        { x: 1.5, y: 0.5 }, // To pin3
      ],
    },
    pair3: {
      mspPairId: "pair3",
      mspConnectionPairIds: ["mspPair3"],
      globalConnNetId: "net2", // Different net - should NOT merge
      dcConnNetId: "net2",
      pinIds: ["pin2", "pin4"],
      pins: [
        { pinId: "pin2", x: -1.5, y: -0.5, chipId: "chip1" },
        { pinId: "pin4", x: 1.5, y: -0.5, chipId: "chip2" },
      ],
      tracePath: [
        { x: -1.5, y: -0.5 },
        { x: 1.5, y: -0.5 },
      ],
    },
  }

  const solver = new TraceMergerSolver({
    inputProblem,
    inputTraceMap,
  })

  solver.solve()

  // Should have merged pair1 and pair2 since they're the same net and connect at (0, 0.05)
  // pair3 should remain separate as it's a different net
  expect(Object.keys(solver.mergedTraceMap).length).toBe(2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
