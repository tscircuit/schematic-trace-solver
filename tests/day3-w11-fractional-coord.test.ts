import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - sub-grid fractional coordinate precision routing", () => {
  const points = [
    { x: 0.25, y: 0.75 },
    { x: 35.5, y: 18.25 },
  ]
  const obstacles = [
    { cx: 17.5, cy: 9.0, w: 10.5, h: 8.5 },
  ]
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 0.25,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
