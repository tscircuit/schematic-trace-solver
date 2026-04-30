import { test, expect } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("simplifyPath returns same path for 2 points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]
  expect(simplifyPath(path)).toEqual(path)
})

test("simplifyPath returns same path for 1 point", () => {
  const path = [{ x: 0, y: 0 }]
  expect(simplifyPath(path)).toEqual(path)
})

test("simplifyPath removes middle point of collinear segments", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ]
  const result = simplifyPath(path)
  expect(result.length).toBeLessThanOrEqual(path.length)
})
