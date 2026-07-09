import { test, expect } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("simplifyPath removes duplicate consecutive points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // duplicate
    { x: 1, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("simplifyPath removes collinear horizontal points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 }, // collinear with neighbors
    { x: 3, y: 0 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ])
})

test("simplifyPath removes collinear vertical points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 }, // collinear with neighbors
    { x: 0, y: 3 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 3 },
  ])
})

test("simplifyPath preserves L-shaped turns", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 }, // turn point - should be preserved
    { x: 2, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual(path)
})

test("simplifyPath handles path with only two points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual(path)
})

test("simplifyPath handles empty and single-point paths", () => {
  expect(simplifyPath([])).toEqual([])
  expect(simplifyPath([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }])
})

test("simplifyPath handles duplicate at start of path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 0 }, // duplicate at start
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("simplifyPath handles duplicate at end of path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 1 }, // duplicate at end
  ]
  const result = simplifyPath(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("simplifyPath handles combined duplicates and collinear points", () => {
  // Simulates what _applyBestRoute can produce: path concatenation with
  // both duplicate consecutive points and collinear intermediate points
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // duplicate from concatenation
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 }, // collinear
    { x: 4, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 4, y: 1 },
  ])
})
