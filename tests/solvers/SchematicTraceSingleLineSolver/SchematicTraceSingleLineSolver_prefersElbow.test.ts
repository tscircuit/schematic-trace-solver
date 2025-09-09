import { test, expect } from "bun:test"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"

test("SchematicTraceSingleLineSolver prefers elbow over direct line when both are valid", () => {
  const chipA: InputChip = {
    chipId: "A",
    center: { x: 0, y: 0 },
    width: 0.2,
    height: 0.2,
    pins: [{ pinId: "A1", x: 0, y: 0 }],
  }
  const chipB: InputChip = {
    chipId: "B",
    center: { x: 4, y: 0 },
    width: 0.2,
    height: 0.2,
    pins: [{ pinId: "B1", x: 4, y: 0 }],
  }

  const pins = [
    { pinId: "A1", x: 0, y: 0, _facingDirection: "y+" as const, chipId: "A" },
    { pinId: "B1", x: 4, y: 0, _facingDirection: "y-" as const, chipId: "B" },
  ]

  const guidelines: Guideline[] = []

  const inputProblem: InputProblem = {
    chips: [chipA, chipB],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const solver = new SchematicTraceSingleLineSolver({
    pins: pins as any,
    guidelines,
    inputProblem,
    chipMap: { A: chipA, B: chipB },
  })

  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath).not.toEqual([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
  expect(solver.solvedTracePath!.length).toBeGreaterThan(2)
})
