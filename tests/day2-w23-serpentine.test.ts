import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - multi-point serpentine routing path", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 30 },
    { x: 20, y: 0 },
    { x: 30, y: 30 },
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
