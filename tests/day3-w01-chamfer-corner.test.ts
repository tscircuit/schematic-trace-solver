import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - chamfer corner obstacle clearance resolution", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 30, y: 30 },
  ]
  const obstacles = [
    { cx: 15, cy: 15, w: 8, h: 8 }
  ]
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 0.5,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
