import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - symmetric dual-channel obstacle clearance routing", () => {
  const points = [
    { x: 0, y: 15 },
    { x: 50, y: 15 },
  ]
  const obstacles = [
    { cx: 25, cy: 15, w: 12, h: 12 },
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
