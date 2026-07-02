import { expect, test } from "bun:test"
import {
  countPathCrossings,
  orthogonalSegmentsCross,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

test("orthogonalSegmentsCross detects perpendicular intersection", () => {
  expect(
    orthogonalSegmentsCross(
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
    ),
  ).toBe(true)
})

test("countPathCrossings counts crossings against existing paths", () => {
  const path = [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ]
  const existing = [
    [
      { x: 1, y: 0 },
      { x: 1, y: 2 },
    ],
  ]
  expect(countPathCrossings(path, existing)).toBe(1)
})
