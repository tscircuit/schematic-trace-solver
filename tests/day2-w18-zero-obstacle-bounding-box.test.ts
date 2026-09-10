import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - zero obstacle bounding box expansion", () => {
  const points = [
    { x: -5, y: -5 },
    { x: 5, y: 5 },
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
