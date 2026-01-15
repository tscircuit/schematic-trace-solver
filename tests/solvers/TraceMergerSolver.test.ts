import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

/**
 * Test for Issue #34: Merge same-net trace lines that are close together
 */

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 1.2,
      pins: [
        { pinId: "U1.1", x: -0.8, y: 0.4 },
        { pinId: "U1.2", x: -0.8, y: 0 },
        { pinId: "U1.3", x: -0.8, y: -0.4 },
        { pinId: "U1.4", x: 0.8, y: -0.4 },
        { pinId: "U1.5", x: 0.8, y: 0 },
        { pinId: "U1.6", x: 0.8, y: 0.4 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -3, y: 0.5 },
      width: 0.4,
      height: 0.8,
      pins: [
        { pinId: "C1.1", x: -3, y: 0.9 },
        { pinId: "C1.2", x: -3, y: 0.1 },
      ],
    },
    {
      chipId: "C2",
      center: { x: -3, y: -0.5 },
      width: 0.4,
      height: 0.8,
      pins: [
        { pinId: "C2.1", x: -3, y: -0.1 },
        { pinId: "C2.2", x: -3, y: -0.9 },
      ],
    },
  ],
  netConnections: [
    {
      pinIds: ["U1.3", "C1.2", "C2.1"],
      netId: "GND",
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "C1.1"],
      netId: "VCC",
    },
    {
      pinIds: ["U1.2", "C2.2"],
      netId: "SIG",
    },
  ],
  availableNetLabelOrientations: {
    GND: ["y-"],
    VCC: ["y+"],
    SIG: ["x-"],
  },
  maxMspPairDistance: 5,
}

test("TraceMergerSolver: pipeline solver snapshot", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
