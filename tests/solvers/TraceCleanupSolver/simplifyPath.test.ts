import { expect, test } from "bun:test"
import {
  removeConsecutiveDuplicatePoints,
  simplifyPath,
} from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("removeConsecutiveDuplicatePoints removes zero-length path segments", () => {
  expect(
    removeConsecutiveDuplicatePoints([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 2 },
      { x: 1, y: 2 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 2 },
  ])
})

test("simplifyPath removes duplicate points before collapsing collinear spans", () => {
  expect(
    simplifyPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 4 },
  ])
})

test("simplifyPath reduces a zero-length path to a single point", () => {
  expect(
    simplifyPath([
      { x: 3, y: 4 },
      { x: 3, y: 4 },
    ]),
  ).toEqual([{ x: 3, y: 4 }])
})
