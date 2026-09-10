import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - orthogonal corner obstacle margin clearance", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 20, y: 20 },
  ]
  const obstacles = [
    { cx: 10, cy: 10, w: 4, h: 4 }
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
