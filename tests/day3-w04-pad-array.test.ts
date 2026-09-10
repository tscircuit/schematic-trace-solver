import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - dense pad array escape fanout routing", () => {
  const points = [
    { x: 5, y: 5 },
    { x: 35, y: 15 },
  ]
  const obstacles = [
    { cx: 20, cy: 10, w: 4, h: 4 },
    { cx: 20, cy: 18, w: 4, h: 4 },
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
