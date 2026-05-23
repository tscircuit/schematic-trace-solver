import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { test, expect } from "bun:test"

test("simplifyPath - collinear points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ]
  const simplified = simplifyPath(path)
  expect(simplified).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
  ])
})

test("simplifyPath - duplicate consecutive points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ]
  const simplified = simplifyPath(path)
  expect(simplified).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ])
})

test("simplifyPath - short path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  const simplified = simplifyPath(path)
  expect(simplified).toEqual(path)
})
