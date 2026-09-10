import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - orthogonal corner bypass routing", () => {
  const points = [
    { x: -5, y: -5 },
    { x: 35, y: 35 },
  ]
  const obstacles = [
    { cx: 15, cy: 15, w: 20, h: 20 },
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
