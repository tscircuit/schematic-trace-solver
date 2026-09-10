import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - U-turn obstacle wrap-around bypass routing", () => {
  const points = [
    { x: 10, y: 0 },
    { x: 10, y: -20 },
  ]
  const obstacles = [
    { cx: 10, cy: -10, w: 30, h: 6 },
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
