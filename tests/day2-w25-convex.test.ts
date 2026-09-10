import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - convex hull obstacle envelope routing", () => {
  const points = [{ x: 5, y: 5 }, { x: 45, y: 45 }]
  const obstacles = [{ cx: 25, cy: 25, w: 15, h: 15 }]
  const result = findSchematicRoute({ points, obstacles, gridSize: 1 } as any)
  expect(result).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
