import { test, expect } from "bun:test"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import { calculateElbow } from "calculate-elbow"
import { generateElbowVariants } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/generateElbowVariants"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"

const pathLength = (pts: { x: number; y: number }[]) => {
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    const dy = pts[i + 1].y - pts[i].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

test("SchematicTraceSingleLineSolver chooses shortest candidate path", () => {
  const chipA: InputChip = {
    chipId: "A",
    center: { x: 0, y: 0 },
    width: 0.2,
    height: 0.2,
    pins: [{ pinId: "A1", x: 0, y: 0 }],
  }
  const chipB: InputChip = {
    chipId: "B",
    center: { x: 4, y: 2 },
    width: 0.2,
    height: 0.2,
    pins: [{ pinId: "B1", x: 4, y: 2 }],
  }

  const pins = [
    { pinId: "A1", x: 0, y: 0, _facingDirection: "x+" as const, chipId: "A" },
    { pinId: "B1", x: 4, y: 2, _facingDirection: "x+" as const, chipId: "B" },
  ]

  const guidelines: Guideline[] = [
    { orientation: "vertical", x: 4, y: undefined },
    { orientation: "vertical", x: 6, y: undefined },
  ]

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

  const shortestLength = Math.min(
    ...solver.allCandidatePaths.map(pathLength),
  )

  expect(pathLength(solver.solvedTracePath!)).toBe(shortestLength)
})
