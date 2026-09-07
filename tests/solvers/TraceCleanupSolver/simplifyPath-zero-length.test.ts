import { test, expect } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("simplifyPath: removes zero-length segments (duplicate consecutive points)", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result.length).toBe(3)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("simplifyPath: removes zero-length segments within tolerance (1e-7)", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1e-7 },
    { x: 2, y: 3 },
  ]
  const result = simplifyPath(path)
  expect(result.length).toBeLessThanOrEqual(3)
})

test("simplifyPath: normal L-shaped path is preserved", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 4 },
  ]
  const result = simplifyPath(path)
  expect(result).toEqual(path)
})

test("simplifyPath: collinear middle point is removed", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(result.length).toBe(3)
  expect(result[1]).toEqual({ x: 2, y: 0 })
})

test("simplifyPath: multiple zero-length duplicates all removed", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 3 },
  ]
  const result = simplifyPath(path)
  expect(result.length).toBe(3)
})
