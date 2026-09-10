import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - diagonal step coordinate resolution", () => {
  const points = [
    { x: 10, y: 10 },
    { x: 30, y: 50 },
  ]
  const obstacles: any[] = []
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 0.5,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
