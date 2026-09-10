import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - high-density parallel trace routing channel", () => {
  const points = [
    { x: 0, y: 5 },
    { x: 50, y: 5 },
  ]
  const obstacles = [
    { cx: 25, cy: 15, w: 20, h: 4 },
    { cx: 25, cy: -5, w: 20, h: 4 },
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
