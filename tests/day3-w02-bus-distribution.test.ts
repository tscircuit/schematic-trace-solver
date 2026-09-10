import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - multi-pin bus distribution routing layout", () => {
  const points = [
    { x: 10, y: 0 },
    { x: 10, y: 40 },
    { x: 30, y: 20 },
  ]
  const obstacles: any[] = []
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 1,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
