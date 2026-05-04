import { test, expect } from "bun:test"
import {
  removeDuplicateConsecutivePoints,
  simplifyPath,
} from "lib/solvers/TraceCleanupSolver/simplifyPath"

/**
 * Unit tests for removeDuplicateConsecutivePoints.
 *
 * This utility is the core fix for issue #78: when UntangleTraceSubsolver
 * splices a rerouted segment back into the original trace path the junction
 * points appear twice (once at the end of the left slice and again at the
 * start of bestRoute, or at the end of bestRoute and the start of the right
 * slice).  Those zero-length duplicate segments render as extra trace lines
 * in the schematic viewer.
 */

test("removeDuplicateConsecutivePoints: removes exact duplicate consecutive points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 }, // duplicate of next
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints: removes points within epsilon (1e-9)", () => {
  const eps = 5e-10 // less than 1e-9
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1 + eps, y: eps }, // near-duplicate of previous
    { x: 2, y: 0 },
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints: keeps non-duplicate points unchanged", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual(path)
})

test("removeDuplicateConsecutivePoints: handles empty path", () => {
  expect(removeDuplicateConsecutivePoints([])).toEqual([])
})

test("removeDuplicateConsecutivePoints: handles single-point path", () => {
  const path = [{ x: 1, y: 2 }]
  expect(removeDuplicateConsecutivePoints(path)).toEqual(path)
})

test("removeDuplicateConsecutivePoints: removes all duplicates in a run", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  expect(removeDuplicateConsecutivePoints(path)).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("removeDuplicateConsecutivePoints: does NOT remove non-consecutive duplicates", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 }, // same as first but NOT consecutive
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual(path)
})

test("simplifyPath: duplicate boundary points from _applyBestRoute splice are removed", () => {
  // Simulate the splice that _applyBestRoute performs (issue #78 root cause).
  // Original path: A - B - C - D
  // p2 = B (index 1); bestRoute = [A, mid, C]
  // Naive splice: slice(0,1)=[A], bestRoute=[A,mid,C], slice(2)=[C,D]
  //   => [A, A, mid, C, C, D]  -- has two pairs of consecutive duplicates
  // After fix: [A, mid, C, D]

  const A = { x: 0, y: 0 }
  const mid = { x: 0, y: 1 }
  const C = { x: 1, y: 1 }
  const D = { x: 2, y: 1 }

  const originalPath = [A, { x: 1, y: 0 }, C, D]
  const p2Index = 1
  const bestRoute = [A, mid, C]

  const spliced = [
    ...originalPath.slice(0, p2Index), // [A]
    ...bestRoute, // [A, mid, C] — A duplicates end of left slice
    ...originalPath.slice(p2Index + 1), // [C, D]  — C duplicates end of bestRoute
  ]
  // spliced = [A, A, mid, C, C, D]

  const cleaned = simplifyPath(spliced)

  // No consecutive duplicate points in the result
  for (let i = 1; i < cleaned.length; i++) {
    const prev = cleaned[i - 1]
    const curr = cleaned[i]
    expect(prev.x === curr.x && prev.y === curr.y).toBe(false)
  }

  // simplifyPath also removes collinear intermediate points so mid→C→D
  // (all at y=1, going right) collapses to mid→D.  The key invariant is
  // no consecutive duplicates and the path starts at A and ends at D.
  expect(cleaned[0]).toEqual(A)
  expect(cleaned[cleaned.length - 1]).toEqual(D)
})
