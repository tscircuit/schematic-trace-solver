import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import { test, expect } from "bun:test"

test("SchematicTraceSingleLineSolver traces direct line when scraping chip edge", () => {
  const chipA = {
    chipId: "A",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    pins: [{ pinId: "A.1", x: 0.5, y: 0 }],
  }
  const chipB = {
    chipId: "B",
    center: { x: 3, y: 0 },
    width: 1,
    height: 1,
    pins: [{ pinId: "B.1", x: 2.5, y: 0 }],
  }
  const chipC = {
    chipId: "C",
    center: { x: 1.5, y: 0.5 },
    width: 1,
    height: 1,
    pins: [],
  }

  const inputProblem = {
    chips: [chipA, chipB, chipC],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const solver = new SchematicTraceSingleLineSolver({
    pins: [
      { pinId: "A.1", x: 0.5, y: 0, chipId: "A" },
      { pinId: "B.1", x: 2.5, y: 0, chipId: "B" },
    ],
    guidelines: [],
    inputProblem: inputProblem as any,
    chipMap: { A: chipA, B: chipB, C: chipC },
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath).toEqual([
    { x: 0.5, y: 0 },
    { x: 2.5, y: 0 },
  ])
})
