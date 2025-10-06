import { expect, test } from "bun:test"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"

test("long collision-free traces should be used directly - showcasing bounty #68", () => {
  // This test demonstrates the bounty #68 feature: "Allow long traces that don't cross any other traces"
  // When the direct elbow path has no collisions, it should be used immediately without pathfinding
  
  const inputProblem = {
    chips: [
      // Left chip with pin facing right
      {
        chipId: "chip_left",
        center: { x: -5, y: 0 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "left_pin",
            x: -4.5, // Right edge of left chip
            y: 0,
          },
        ],
      },
      // Right chip with pin facing left - far away to create a long trace
      {
        chipId: "chip_right", 
        center: { x: 5, y: 2 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "right_pin",
            x: 4.5, // Left edge of right chip
            y: 2,
          },
        ],
      },
      // Obstacle chip that doesn't interfere with the direct path
      {
        chipId: "obstacle",
        center: { x: 0, y: -3 },
        width: 1.5,
        height: 1.5,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const chipMap = {
    chip_left: inputProblem.chips[0],
    chip_right: inputProblem.chips[1], 
    obstacle: inputProblem.chips[2],
  }

  const pins = [
    {
      pinId: "left_pin",
      x: -4.5,
      y: 0,
      chipId: "chip_left",
      _facingDirection: "x+" as const, // Facing right
    },
    {
      pinId: "right_pin", 
      x: 4.5,
      y: 2,
      chipId: "chip_right",
      _facingDirection: "x-" as const, // Facing left
    },
  ]

  const solver = new SchematicTraceSingleLineSolver2({
    inputProblem: inputProblem as any,
    chipMap: chipMap as any,
    pins: pins as any,
  })

  // Should be solved immediately since the long trace has no collisions
  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath).not.toBeNull()
  expect(solver.solvedTracePath?.length).toBeGreaterThan(2) // Elbow path has multiple points
  
  // The path should be the collision-free base elbow path
  expect(solver.solvedTracePath).toEqual(solver.baseElbow)
  
  // Verify the path connects the pins correctly
  const path = solver.solvedTracePath!
  expect(path[0]).toEqual({ x: -4.5, y: 0 })
  expect(path[path.length - 1]).toEqual({ x: 4.5, y: 2 })

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("collision-free diagonal connection with obstacles nearby", () => {
  // Another test case showing long traces work when obstacles don't interfere
  
  const inputProblem = {
    chips: [
      // Bottom-left chip
      {
        chipId: "chip_bl",
        center: { x: -4, y: -3 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "bl_pin",
            x: -3.5, // Right edge
            y: -3,
          },
        ],
      },
      // Top-right chip - creating a diagonal long trace
      {
        chipId: "chip_tr",
        center: { x: 4, y: 3 },
        width: 1,
        height: 1,
        pins: [
          {
            pinId: "tr_pin",
            x: 3.5, // Left edge
            y: 3,
          },
        ],
      },
      // Obstacle chips that don't block the path (positioned away from the elbow)
      {
        chipId: "obstacle1",
        center: { x: -1, y: 2 },
        width: 0.5,
        height: 0.5,
        pins: [],
      },
      {
        chipId: "obstacle2", 
        center: { x: 1, y: -2 },
        width: 0.5,
        height: 0.5,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const chipMap = {
    chip_bl: inputProblem.chips[0],
    chip_tr: inputProblem.chips[1],
    obstacle1: inputProblem.chips[2],
    obstacle2: inputProblem.chips[3],
  }

  const pins = [
    {
      pinId: "bl_pin",
      x: -3.5,
      y: -3,
      chipId: "chip_bl",
      _facingDirection: "x+" as const,
    },
    {
      pinId: "tr_pin",
      x: 3.5,
      y: 3,
      chipId: "chip_tr", 
      _facingDirection: "x-" as const,
    },
  ]

  const solver = new SchematicTraceSingleLineSolver2({
    inputProblem: inputProblem as any,
    chipMap: chipMap as any,
    pins: pins as any,
  })

  // Should be solved immediately with collision-free elbow
  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath).not.toBeNull()
  expect(solver.solvedTracePath).toEqual(solver.baseElbow)

  expect(solver).toMatchSolverSnapshot(import.meta.path, "diagonal-collision-free")
})