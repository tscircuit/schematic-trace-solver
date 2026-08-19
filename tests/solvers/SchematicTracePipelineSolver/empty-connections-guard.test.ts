import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("SchematicTracePipelineSolver handles empty connections array without crashing (#657)", () => {
  const emptyProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "p1", x: 0.5, y: 0 },
          { pinId: "p2", x: -0.5, y: 0 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const solver = new SchematicTracePipelineSolver(emptyProblem)
  expect(() => solver.solve()).not.toThrow()
  expect(solver.solved).toBe(true)
})

test("MspConnectionPairSolver handles empty and undefined connection arrays safely", () => {
  const emptyProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  } as unknown as InputProblem

  const solver = new MspConnectionPairSolver({ inputProblem: emptyProblem })
  expect(() => solver.solve()).not.toThrow()
  expect(solver.solved).toBe(true)
  expect(solver.mspConnectionPairs).toEqual([])
})
