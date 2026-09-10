import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - snap grid tolerance for non-orthogonal routing coordinates", () => {
  const points = [
    { x: 0.001, y: 0.002 },
    { x: 10.004, y: 0.001 },
    { x: 10.002, y: 15.003 },
  ]
  const obstacles: any[] = []
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 0.1,
  } as any)

  expect(result).toBeDefined()
  expect(Array.isArray(result.routes)).toBe(true)
})
