import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - zero-distance terminal endpoint alignment handling", () => {
  const points = [
    { x: 10, y: 10 },
    { x: 10, y: 10 },
  ]
  const obstacles = []
  const result = findSchematicRoute({
    points,
    obstacles,
    gridSize: 1,
  } as any)

  expect(result).toBeDefined()
  expect(result.routes).toBeDefined()
})
