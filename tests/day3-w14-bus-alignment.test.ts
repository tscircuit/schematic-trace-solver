import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - parallel bus multi-pin obstacle routing", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
  ]
  const obstacles = [
    { cx: 25, cy: 0, w: 10, h: 10 },
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
