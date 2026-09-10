import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - T-junction trace intersection obstacle avoidance", () => {
  const points = [
    { x: 0, y: 20 },
    { x: 40, y: 20 },
  ]
  const obstacles = [
    { cx: 20, cy: 20, w: 8, h: 8 },
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
