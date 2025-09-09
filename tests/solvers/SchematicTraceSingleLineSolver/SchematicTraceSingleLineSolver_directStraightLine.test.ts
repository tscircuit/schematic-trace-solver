import { test, expect } from "bun:test"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"

test("SchematicTraceSingleLineSolver uses single straight segment when possible", () => {
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
  const obstacle: InputChip = {
    chipId: "C",
    center: { x: 2, y: 0.1 },
    width: 0.2,
    height: 0.2,
    pins: [],
  }

  const pins = [
    { pinId: "A1", x: 0, y: 0, _facingDirection: "x+" as const, chipId: "A" },
    { pinId: "B1", x: 4, y: 0, _facingDirection: "x-" as const, chipId: "B" },
  ]

  const guidelines: Guideline[] = []

  const inputProblem: InputProblem = {
    chips: [chipA, chipB, obstacle],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const solver = new SchematicTraceSingleLineSolver({
    pins: pins as any,
    guidelines,
    inputProblem,
    chipMap: { A: chipA, B: chipB, C: obstacle },
  })

  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath).toEqual([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
})
