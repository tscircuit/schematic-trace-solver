import { expect, test } from "bun:test"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"

test("detects a strict crossing on a terminal segment", () => {
  expect(
    findPerpendicularPathCrossings(
      [
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ],
      [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
      { includeTerminalSegments: true },
    ),
  ).toEqual([{ pathSegmentIndex: 0, otherPathSegmentIndex: 0 }])
})

test("allows terminal segments to meet at their endpoints", () => {
  expect(
    findPerpendicularPathCrossings(
      [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      { includeTerminalSegments: true },
    ),
  ).toEqual([])
})
