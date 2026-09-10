import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - 45-degree diagonal corridor obstacle bypass routing", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 40, y: 40 },
  ]
  const obstacles = [
    { cx: 15, cy: 25, w: 10, h: 10 },
    { cx: 25, cy: 15, w: 10, h: 10 },
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
