import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - non-orthogonal boundary clearance routing", () => {
  const points = [
    { x: 5, y: 5 },
    { x: 55, y: 35 },
  ]
  const obstacles = [
    { cx: 30, cy: 20, w: 14, h: 14 },
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
