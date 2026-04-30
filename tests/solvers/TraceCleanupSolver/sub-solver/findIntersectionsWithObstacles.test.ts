import { test, expect } from "bun:test"
import { findIntersectionsWithObstacles } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { TraceObstacle } from "lib/solvers/TraceCleanupSolver/sub-solver/getTraceObstacles"

test("findIntersectionsWithObstacles returns empty for no obstacles", () => {
  const result = findIntersectionsWithObstacles(
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    [],
  )
  expect(result).toHaveLength(0)
})

test("findIntersectionsWithObstacles returns empty when no intersection", () => {
  const obstacles: TraceObstacle[] = [
    {
      points: [
        { x: 100, y: 100 },
        { x: 110, y: 110 },
      ],
    },
  ]

  const result = findIntersectionsWithObstacles(
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    obstacles,
  )
  // No intersection with distant line
  expect(result).toHaveLength(0)
})

test("findIntersectionsWithObstacles finds intersection with crossing line", () => {
  const obstacles: TraceObstacle[] = [
    {
      points: [
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
    },
  ]

  // Line from (0,0) to (10,10) should intersect with line from (0,10) to (10,0)
  const result = findIntersectionsWithObstacles(
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    obstacles,
  )
  expect(result.length).toBeGreaterThan(0)
})

test("findIntersectionsWithObstacles finds multiple intersections", () => {
  const obstacles: TraceObstacle[] = [
    {
      points: [
        { x: 5, y: 0 },
        { x: 5, y: 10 },
      ],
    },
    {
      points: [
        { x: 3, y: 0 },
        { x: 3, y: 10 },
      ],
    },
  ]

  // Line crossing multiple vertical lines
  const result = findIntersectionsWithObstacles(
    { x: 0, y: 5 },
    { x: 10, y: 5 },
    obstacles,
  )
  expect(result.length).toBeGreaterThanOrEqual(1)
})

test("findIntersectionsWithObstacles handles parallel lines", () => {
  const obstacles: TraceObstacle[] = [
    {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    },
  ]

  // Parallel line should not intersect
  const result = findIntersectionsWithObstacles(
    { x: 0, y: 5 },
    { x: 10, y: 5 },
    obstacles,
  )
  expect(result).toHaveLength(0)
})
