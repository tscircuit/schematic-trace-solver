import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - S-curve orthogonal bend avoidance routing", () => {
  const points = [
    { x: 0, y: 10 },
    { x: 50, y: 30 },
  ]
  const obstacles = [
    { cx: 25, cy: 20, w: 10, h: 25 },
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
