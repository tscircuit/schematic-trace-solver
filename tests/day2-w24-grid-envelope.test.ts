import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - rectangular routing envelope with bounding obstacles", () => {
  const points = [
    { x: -20, y: -20 },
    { x: 40, y: 40 },
  ]
  const obstacles = [
    { cx: 10, cy: 0, w: 10, h: 20 },
    { cx: -10, cy: 10, w: 10, h: 20 },
  ]
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 1,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
