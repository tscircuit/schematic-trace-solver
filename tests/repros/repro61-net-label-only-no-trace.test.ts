import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTracePipelineSolver } from "lib/index"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * repro61: Two capacitors whose pins share nets (GND, VCC) only via net labels
 * (netConnections), with no directConnections between them. The solver should
 * NOT create routed traces between them — only net labels should appear.
 *
 * See: https://github.com/tscircuit/schematic-trace-solver/issues/79
 *      https://github.com/tscircuit/core/pull/1503
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: -1, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: -1, y: 0.5 },
        { pinId: "C1.2", x: -1, y: -0.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 1, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 1, y: 0.5 },
        { pinId: "C2.2", x: 1, y: -0.5 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VCC", pinIds: ["C1.1", "C2.1"] },
    { netId: "GND", pinIds: ["C1.2", "C2.2"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
}

test("repro61: MspConnectionPairSolver produces zero pairs for net-label-only connections", () => {
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  // No direct connections → no MSP pairs should be generated
  expect(solver.mspConnectionPairs.length).toBe(0)
})

test("repro61: pipeline produces no routed traces for net-label-only connections", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const traces = solver.schematicTraceLinesSolver?.solvedTracePaths ?? []
  const longDistanceTraces =
    solver.longDistancePairSolver?.solvedLongDistanceTraces ?? []

  // No direct connections → no routed traces at all
  expect(traces.length).toBe(0)
  expect(longDistanceTraces.length).toBe(0)
})
