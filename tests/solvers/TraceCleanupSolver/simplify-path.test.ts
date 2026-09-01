import { expect, test } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("removes duplicate consecutive points (zero-length segments)", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // duplicate
    { x: 2, y: 0 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("removes duplicate at start", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 0 }, // duplicate of start
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("removes duplicate at end", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 1 }, // duplicate of end
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("collapses collinear points on horizontal segment", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 1 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 1 },
  ])
})

test("collapses collinear points on vertical segment", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ])
})

test("handles multiple consecutive duplicates", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // three copies of same point
    { x: 2, y: 0 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("handles L-shaped path with no simplification needed", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("removes zero-length segment followed by direction change", () => {
  // Duplicate point creates an extra trace line when rendered
  const path = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 0 }, // zero-length stub → causes extra line in post-processing
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ])
})
