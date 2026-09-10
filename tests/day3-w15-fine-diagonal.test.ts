import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - fine-grid diagonal staircase resolution", () => {
  const points = [
    { x: 2.5, y: 2.5 },
    { x: 37.5, y: 37.5 },
  ]
  const obstacles = [
    { cx: 20, cy: 20, w: 10, h: 10 },
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
