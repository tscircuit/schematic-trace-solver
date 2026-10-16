import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "../lib"
import { ChipObstacleSpatialIndex } from "../lib/data-structures/ChipObstacleSpatialIndex"

test("SchematicTracePipelineSolver does not crash on empty connections and chips (#657)", () => {
  const emptyProblemSolver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  expect(() => emptyProblemSolver.solve()).not.toThrow()
  expect(emptyProblemSolver.solved).toBe(true)
  expect(emptyProblemSolver.failed).toBe(false)

  const emptyConnectionsSolver = new SchematicTracePipelineSolver({
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [
          { pinId: "U1.1", x: -1, y: 0 },
          { pinId: "U1.2", x: 1, y: 0 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  expect(() => emptyConnectionsSolver.solve()).not.toThrow()
  expect(emptyConnectionsSolver.solved).toBe(true)
  expect(emptyConnectionsSolver.failed).toBe(false)
})

test("ChipObstacleSpatialIndex handles empty chips array without Flatbush error", () => {
  const spatialIndex = new ChipObstacleSpatialIndex([])

  expect(
    spatialIndex.getChipsInBounds({ minX: -10, minY: -10, maxX: 10, maxY: 10 }),
  ).toEqual([])
  expect(
    spatialIndex.doesOrthogonalLineIntersectChip([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]),
  ).toBe(false)
})
