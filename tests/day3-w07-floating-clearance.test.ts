import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - floating obstacle margin clearance routing", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 60, y: 40 },
  ]
  const obstacles = [
    { cx: 30, cy: 20, w: 15, h: 15 },
  ]
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 1,
    margin: 2,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
