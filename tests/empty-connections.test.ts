import { describe, expect, test } from "bun:test"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

describe("empty connections and chips handling (#657)", () => {
  test("ChipObstacleSpatialIndex handles empty chips array without throwing", () => {
    const index = new ChipObstacleSpatialIndex([])
    expect(
      index.getChipsInBounds({ minX: -10, minY: -10, maxX: 10, maxY: 10 }),
    ).toEqual([])
    expect(
      index.doesOrthogonalLineIntersectChip([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ]),
    ).toBe(false)
  })

  test("SchematicTracePipelineSolver solves empty problem without crashing", () => {
    const solver = new SchematicTracePipelineSolver({
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)
    expect(solver.schematicTraceLinesSolver?.solvedTracePaths ?? []).toEqual([])
  })

  test("SchematicTracePipelineSolver solves chips with empty connections arrays", () => {
    const solver = new SchematicTracePipelineSolver({
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

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)
    expect(solver.schematicTraceLinesSolver?.solvedTracePaths ?? []).toEqual([])
  })
})
