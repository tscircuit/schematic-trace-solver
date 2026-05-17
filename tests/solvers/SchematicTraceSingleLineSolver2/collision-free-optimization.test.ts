import { expect, test } from "bun:test"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"

test("collision-free base elbow should be used directly without pathfinding", () => {
  // Simple test case where pins are far apart with no obstacles in between
  const inputProblem = {
    chips: [
      {
        chipId: "chip1",
        center: { x: -2, y: 0 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "pin1",
            x: -1.5,
            y: 0,
          },
        ],
      },
      {
        chipId: "chip2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "pin2",
            x: 1.5,
            y: 0,
          },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const chipMap = {
    chip1: inputProblem.chips[0],
    chip2: inputProblem.chips[1],
  }

  const pins = [
    {
      pinId: "pin1",
      x: -1.5,
      y: 0,
      chipId: "chip1",
      _facingDirection: "x+" as const,
    },
    {
      pinId: "pin2",
      x: 1.5,
      y: 0,
      chipId: "chip2",
      _facingDirection: "x-" as const,
    },
  ]

  const solver = new SchematicTraceSingleLineSolver2({
    inputProblem: inputProblem as any,
    chipMap: chipMap as any,
    pins: pins as any,
  })

  // Should be solved immediately since there are no collisions
  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath).not.toBeNull()
  expect(solver.solvedTracePath?.length).toBeGreaterThan(0)
})
