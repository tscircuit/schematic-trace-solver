import { expect, test } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const rect = {
  minX: 0,
  maxX: 2,
  minY: 0,
  maxY: 2,
}

test("interior crossings remain collisions", () => {
  expect(segmentIntersectsRect({ x: -1, y: 1 }, { x: 1, y: 1 }, rect)).toBe(
    true,
  )
})
