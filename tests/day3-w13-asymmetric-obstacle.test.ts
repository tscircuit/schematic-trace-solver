import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - asymmetric aspect-ratio obstacle perimeter clearance", () => {
  const points = [
    { x: -5, y: 10 },
    { x: 45, y: 10 },
  ]
  const obstacles = [
    { cx: 20, cy: 10, w: 4, h: 40 },
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
