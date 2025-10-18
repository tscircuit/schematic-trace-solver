import { expect, test } from "bun:test"
import { calculateElbow } from "calculate-elbow"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import type { InputChip, InputProblem } from "lib/types/InputProblem"

const buildChip = (
  chipId: string,
  center: { x: number; y: number },
  width: number,
  height: number,
  pins: Array<{ pinId: string; x: number; y: number }>,
): InputChip => ({
  chipId,
  center,
  width,
  height,
  pins,
})

test("allows long traces when restricted center line is far away", () => {
  const chipA = buildChip("A", { x: 0, y: 0 }, 0.4, 0.4, [
    { pinId: "A1", x: 0, y: 0 },
  ])
  const chipB = buildChip("B", { x: 10, y: 0 }, 0.4, 0.4, [
    { pinId: "B1", x: 10, y: 0 },
  ])
  const chipC = buildChip("C", { x: 5, y: 10 }, 1, 1, [
    { pinId: "C1", x: 4.5, y: 10 },
    { pinId: "C2", x: 5.5, y: 10 },
  ])

  const inputProblem: InputProblem = {
    chips: [chipA, chipB, chipC],
    directConnections: [
      { pinIds: ["A1", "C1"], netId: "N1" },
      { pinIds: ["B1", "C2"], netId: "N1" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const pins = [
    { pinId: "A1", x: 0, y: 0, chipId: "A", _facingDirection: "x+" as const },
    { pinId: "B1", x: 10, y: 0, chipId: "B", _facingDirection: "x-" as const },
  ]

  const solver = new SchematicTraceSingleLineSolver({
    pins: pins as any,
    guidelines: [],
    inputProblem,
    chipMap: { A: chipA, B: chipB, C: chipC },
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const baseElbow = calculateElbow(
    { x: pins[0].x, y: pins[0].y, facingDirection: pins[0]._facingDirection },
    { x: pins[1].x, y: pins[1].y, facingDirection: pins[1]._facingDirection },
    { overshoot: 0.2 },
  )

  expect(solver.solvedTracePath).toEqual(baseElbow)
})
