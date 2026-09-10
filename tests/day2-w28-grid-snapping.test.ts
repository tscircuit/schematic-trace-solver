import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - floating offset grid point alignment", () => {
  const points = [{ x: 1.234, y: 5.678 }, { x: 21.234, y: 25.678 }]
  const obstacles: any[] = []
  const result = findSchematicRoute({ points, obstacles, gridSize: 0.1 } as any)
  expect(result).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
