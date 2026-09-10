import test, { expect } from "bun:test"
import { findSchematicRoute } from "../lib/index"

test("schematic-trace-solver - narrow routing bottleneck negotiation", () => {
  const points = [{ x: 0, y: 0 }, { x: 40, y: 0 }]
  const obstacles = [
    { cx: 20, cy: 10, w: 10, h: 18 },
    { cx: 20, cy: -10, w: 10, h: 18 },
  ]
  const result = findSchematicRoute({ points, obstacles, gridSize: 0.5 } as any)
  expect(result).toBeDefined()
  expect(result.routes.length).toBeGreaterThanOrEqual(1)
})
