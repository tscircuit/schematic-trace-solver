import { test, expect } from "bun:test"
import { visualizeIntersectionPoints } from "lib/solvers/TraceCleanupSolver/sub-solver/visualizeIntersectionPoints"

test("visualizeIntersectionPoints returns empty for empty array", () => {
  const result = visualizeIntersectionPoints([])
  expect(result.circles).toHaveLength(0)
})

test("visualizeIntersectionPoints creates circle for each point", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 5, y: 5 },
    { x: 10, y: 10 },
  ]

  const result = visualizeIntersectionPoints(points)
  expect(result.circles).toHaveLength(3)
})

test("visualizeIntersectionPoints uses default red color", () => {
  const points = [{ x: 5, y: 5 }]

  const result = visualizeIntersectionPoints(points)
  expect(result.circles![0].fill).toBe("red")
})

test("visualizeIntersectionPoints accepts custom color", () => {
  const points = [{ x: 5, y: 5 }]

  const result = visualizeIntersectionPoints(points, "blue")
  expect(result.circles![0].fill).toBe("blue")
})

test("visualizeIntersectionPoints creates circles with correct centers", () => {
  const points = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ]

  const result = visualizeIntersectionPoints(points)
  expect(result.circles![0].center).toEqual({ x: 1, y: 2 })
  expect(result.circles![1].center).toEqual({ x: 3, y: 4 })
})

test("visualizeIntersectionPoints uses correct radius", () => {
  const points = [{ x: 0, y: 0 }]

  const result = visualizeIntersectionPoints(points)
  expect(result.circles![0].radius).toBe(0.01)
})
