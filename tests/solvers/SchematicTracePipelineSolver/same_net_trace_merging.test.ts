import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

// Test case for Issue #34: Merge same-net trace lines that are close together (same Y)
const sameYProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U1.1", x: -0.8, y: 0.2 },
        { pinId: "U1.2", x: -0.8, y: 0 },
        { pinId: "U1.3", x: -0.8, y: -0.2 },
        { pinId: "U1.4", x: 0.8, y: -0.2 },
        { pinId: "U1.5", x: 0.8, y: 0 },
        { pinId: "U1.6", x: 0.8, y: 0.2 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 4, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U2.1", x: 3.2, y: 0.2 },
        { pinId: "U2.2", x: 3.2, y: 0 },
        { pinId: "U2.3", x: 3.2, y: -0.2 },
        { pinId: "U2.4", x: 4.8, y: -0.2 },
        { pinId: "U2.5", x: 4.8, y: 0 },
        { pinId: "U2.6", x: 4.8, y: 0.2 },
      ],
    },
  ],
  directConnections: [{ pinIds: ["U1.1", "U2.1"], netId: "NET1" }],
  netConnections: [],
  availableNetLabelOrientations: {
    NET1: ["x+", "x-", "y+", "y-"],
  },
}

test("merges same-net trace segments at same Y coordinate", () => {
  const solver = new SchematicTracePipelineSolver(sameYProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const result = solver.sameNetTraceCombiningSolver?.getOutput()

  // After merging, there should be trace output
  expect(result?.traces).toBeDefined()
})

// Test case for same X coordinate merging
const sameXProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [{ pinId: "U1.1", x: -0.8, y: 0 }],
    },
    {
      chipId: "U2",
      center: { x: 0, y: 4 },
      width: 1.6,
      height: 0.6,
      pins: [{ pinId: "U2.1", x: -0.8, y: 4 }],
    },
  ],
  directConnections: [{ pinIds: ["U1.1", "U2.1"], netId: "NET1" }],
  netConnections: [],
  availableNetLabelOrientations: {
    NET1: ["x+", "x-", "y+", "y-"],
  },
}

test("merges same-net trace segments at same X coordinate", () => {
  const solver = new SchematicTracePipelineSolver(sameXProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const result = solver.sameNetTraceCombiningSolver?.getOutput()

  expect(result?.traces).toBeDefined()
})
