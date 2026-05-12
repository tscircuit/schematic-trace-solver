import { expect, test } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("simplifyPath removes redundant collinear points in a single pass", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ]

  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ])
})

test("simplifyPath is idempotent after the cleanup pass", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 3 },
  ]
  const simplified = simplifyPath(path)

  expect(simplifyPath(simplified)).toEqual(simplified)
})
