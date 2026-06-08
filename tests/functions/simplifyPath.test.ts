import { expect, test } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("simplifyPath removes consecutive duplicate points before collinear collapse", () => {
  expect(
    simplifyPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
})

test("simplifyPath returns a deduplicated short path", () => {
  expect(
    simplifyPath([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
})
