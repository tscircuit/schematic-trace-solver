import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - concave cavity obstacle perimeter escape routing", () => {
  const points = [
    { x: 10, y: 10 },
    { x: 50, y: 30 },
  ]
  const obstacles = [
    { cx: 20, cy: 10, w: 6, h: 20 },
    { cx: 30, cy: 0, w: 20, h: 6 },
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
