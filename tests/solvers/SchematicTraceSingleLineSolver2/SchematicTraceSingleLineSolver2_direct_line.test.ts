import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import { test, expect } from "bun:test"

test("SchematicTraceSingleLineSolver2 traces direct horizontal line when possible", () => {
  const chipA = {
    chipId: "A",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    pins: [
      {
        pinId: "A.1",
        x: 0.5,
        y: 0,
      },
    ],
  }
  const chipB = {
    chipId: "B",
    center: { x: 3, y: 0 },
    width: 1,
    height: 1,
    pins: [
      {
        pinId: "B.1",
        x: 2.5,
        y: 0,
      },
    ],
  }

  const input = {
    chipMap: {
      A: chipA,
      B: chipB,
    },
    pins: [
      { pinId: "A.1", x: 0.5, y: 0, chipId: "A" },
      { pinId: "B.1", x: 2.5, y: 0, chipId: "B" },
    ],
    inputProblem: {
      chips: [chipA, chipB],
    },
  }

  const solver = new SchematicTraceSingleLineSolver2(input as any)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath).toEqual([
    { x: 0.5, y: 0 },
    { x: 2.5, y: 0 },
  ])
})
