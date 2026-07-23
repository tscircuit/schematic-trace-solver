import { expect, test } from "bun:test"
import { segmentOverlapsRectBoundary } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const rect = {
  minX: 0,
  maxX: 2,
  minY: 0,
  maxY: 2,
}

test("detects segments that overlap rectangle boundaries", () => {
  expect(
    segmentOverlapsRectBoundary({ x: -1, y: 0 }, { x: 1, y: 0 }, rect),
  ).toBe(true)
  expect(
    segmentOverlapsRectBoundary({ x: 2, y: -1 }, { x: 2, y: 1 }, rect),
  ).toBe(true)
})
