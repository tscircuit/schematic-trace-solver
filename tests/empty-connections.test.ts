import { expect, test } from "bun:test"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

test("SchematicTracePipelineSolver solves cleanly when connections arrays are empty", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [
          { pinId: "U1.1", x: -1, y: 0.5 },
          { pinId: "U1.2", x: 1, y: 0.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.netLabelToTraceSolver?.getOutput().traces ?? []).toEqual([])
})

test("SchematicTracePipelineSolver and ChipObstacleSpatialIndex handle empty chips and empty connections without crashing", () => {
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

  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.netLabelToTraceSolver?.getOutput().traces ?? []).toEqual([])
})
