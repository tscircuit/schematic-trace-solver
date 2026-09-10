import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - corner notch obstacle corridor clearance", () => {
  const points = [
    { x: -10, y: 0 },
    { x: 40, y: 30 },
  ]
  const obstacles = [
    { cx: 15, cy: 10, w: 12, h: 8 },
    { cx: 15, cy: 22, w: 12, h: 8 },
  ]
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 0.5,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
