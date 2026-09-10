import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - asymmetric pin layout bounding calculation", () => {
  const points = [
    { x: -50, y: 10 },
    { x: 120, y: 85 },
  ]
  const obstacles: any[] = []
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 2,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
