import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - high density obstacle array perimeter routing", () => {
  const points = [
    { x: 5, y: 5 },
    { x: 45, y: 45 },
  ]
  const obstacles = [
    { cx: 15, cy: 15, w: 6, h: 6 },
    { cx: 25, cy: 25, w: 6, h: 6 },
    { cx: 35, cy: 35, w: 6, h: 6 },
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
