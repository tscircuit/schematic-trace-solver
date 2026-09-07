import { expect, test } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("removes duplicate consecutive points (zero-length segments)", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // duplicate
    { x: 2, y: 0 },
  ]
  const result = simplifyPath(path)
  // Collinear + dedup → single segment A→D
  expect(result).toHaveLength(2)
  expect(result[0]).toEqual({ x: 0, y: 0 })
  expect(result[result.length - 1]).toEqual({ x: 2, y: 0 })
})

test("collapses collinear points on a straight horizontal path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ]
  const result = simplifyPath(path)
  expect(result).toHaveLength(2)
})

test("preserves a right-angle turn", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result).toHaveLength(3)
})

test("handles duplicate at start and end without crashing", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
  ]
  const result = simplifyPath(path)
  expect(result[0]).toEqual({ x: 0, y: 0 })
  expect(result[result.length - 1]).toEqual({ x: 1, y: 0 })
})

test("idempotent: simplifying twice gives the same result", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ]
  const once = simplifyPath(path)
  const twice = simplifyPath(once)
  expect(twice).toEqual(once)
})
