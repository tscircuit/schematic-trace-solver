import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - zigzag corridor obstacle bypass routing", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },
  ]
  const obstacles = [
    { cx: 20, cy: 10, w: 10, h: 20 },
    { cx: 35, cy: 40, w: 10, h: 20 },
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
