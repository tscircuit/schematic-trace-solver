import { test, expect } from "bun:test"
import { is4PointRectangle } from "lib/solvers/TraceCleanupSolver/is4PointRectangle"

test("is4PointRectangle returns true for H-V-H rectangle", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 5 },
  ]
  expect(is4PointRectangle(path)).toBe(true)
})

test("is4PointRectangle returns true for V-H-V rectangle", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 5 },
    { x: 10, y: 5 },
    { x: 10, y: 0 },
  ]
  expect(is4PointRectangle(path)).toBe(true)
})

test("is4PointRectangle returns false for 3 points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
  ]
  expect(is4PointRectangle(path)).toBe(false)
})

test("is4PointRectangle returns false for non-rectangle path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 15, y: 5 },
    { x: 0, y: 5 },
  ]
  expect(is4PointRectangle(path)).toBe(false)
})
