import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"

test("SchematicTracePipelineSolver handles empty connections without crashing", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBe(null)
})

test("ChipObstacleSpatialIndex handles empty chips array gracefully", () => {
  const index = new ChipObstacleSpatialIndex([])
  const chipsInBounds = index.getChipsInBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
  expect(chipsInBounds).toEqual([])

  const intersects = index.doesOrthogonalLineIntersectChip([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ])
  expect(intersects).toBe(false)
})
