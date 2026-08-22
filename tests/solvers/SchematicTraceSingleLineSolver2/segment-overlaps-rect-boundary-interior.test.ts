import { expect, test } from "bun:test"
import { segmentOverlapsRectBoundary } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const rect = {
  minX: 0,
  maxX: 2,
  minY: 0,
  maxY: 2,
}

test("does not treat interior crossings as boundary overlaps", () => {
  expect(
    segmentOverlapsRectBoundary({ x: -1, y: 1 }, { x: 1, y: 1 }, rect),
  ).toBe(false)
  expect(
    segmentOverlapsRectBoundary({ x: 1, y: -1 }, { x: 1, y: 1 }, rect),
  ).toBe(false)
})
