import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

// Repro for tscircuit/schematic-trace-solver#79 ("Fix extra net label in repro61,
// or remove trace") — sourced from the test added in tscircuit/core#1503.
//
// Two capacitors share two nets (GND, VCC) via net labels only. There are no
// directConnections, so the solver should produce zero routed traces — only
// the four net labels. Previously, MspConnectionPairSolver iterated the union
// connectivity map and created MSP pairs for net-only connections, causing
// SchematicTraceLinesSolver to draw "jumping" traces between pins that should
// have been independent net labels.
test("repro61: net-label-only pins do not produce routed traces", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "C1",
        center: { x: 2, y: 0 },
        width: 0.53,
        height: 1.1,
        pins: [
          { pinId: "C1.1", x: 2, y: 0.55 },
          { pinId: "C1.2", x: 2, y: -0.55 },
        ],
      },
      {
        chipId: "C2",
        center: { x: 0, y: 0 },
        width: 0.53,
        height: 1.1,
        pins: [
          { pinId: "C2.1", x: 0, y: 0.55 },
          { pinId: "C2.2", x: 0, y: -0.55 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      { netId: "GND", pinIds: ["C1.1", "C2.1"] },
      { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
    ],
    availableNetLabelOrientations: {
      GND: ["y+"],
      VCC: ["y-"],
    },
    maxMspPairDistance: 3,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Both upstream MSP pairing and downstream long-distance routing must skip
  // net-only nets — otherwise the pipeline ends up emitting traces that
  // re-introduce the bug, even though MSP itself produced no pairs.
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs).toHaveLength(0)
  expect(
    solver.longDistancePairSolver!.getOutput().allTracesMerged,
  ).toHaveLength(0)
})
