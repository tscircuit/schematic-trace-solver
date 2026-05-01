import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

/**
 * Repro for https://github.com/tscircuit/schematic-trace-solver/issues/79
 *
 * When nets are connected only via netConnections (net labels like VCC/GND),
 * the solver was incorrectly generating physical wire traces for them.
 *
 * Root cause: getConnectivityMapsFromInputProblem passes directConnMap.netMap
 * by reference to ConnectivityMap. When netConnMap.addConnections adds net-label
 * entries, it mutates the shared object, so queuedDcNetIds in MspConnectionPairSolver
 * includes net-label-only nets and generates spurious traces.
 */

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "R1",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R1.1", x: 0, y: 0.5 },
        { pinId: "R1.2", x: 0, y: -0.5 },
      ],
    },
    {
      chipId: "R2",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R2.1", x: 2, y: 0.5 },
        { pinId: "R2.2", x: 2, y: -0.5 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VCC", pinIds: ["R1.1", "R2.1"] },
    { netId: "GND", pinIds: ["R1.2", "R2.2"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

test("repro61: net-label-only connections should not produce MSP pairs", () => {
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("repro61: net-label-only connections should not produce traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  const traces = solver.schematicTraceLinesSolver?.solvedTracePaths ?? []
  expect(traces).toHaveLength(0)
})
