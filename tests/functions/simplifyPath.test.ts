import { describe, expect, test } from "bun:test"
import {
  removeDuplicateConsecutivePoints,
  simplifyPath,
} from "lib/solvers/TraceCleanupSolver/simplifyPath"

describe("removeDuplicateConsecutivePoints", () => {
  test("removes consecutive duplicates", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 }, // duplicate
      { x: 2, y: 0 },
    ]
    const result = removeDuplicateConsecutivePoints(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
  })

  test("keeps non-consecutive duplicates", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 }, // same as first but not consecutive
    ]
    const result = removeDuplicateConsecutivePoints(path)
    expect(result).toEqual(path)
  })

  test("handles empty path", () => {
    expect(removeDuplicateConsecutivePoints([])).toEqual([])
  })

  test("handles single point", () => {
    const path = [{ x: 1, y: 2 }]
    expect(removeDuplicateConsecutivePoints(path)).toEqual(path)
  })

  test("removes multiple consecutive duplicates", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
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
})

describe("simplifyPath", () => {
  test("removes collinear points on horizontal segment", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ])
  })

  test("removes duplicate junction point introduced by _applyBestRoute splice", () => {
    // When _applyBestRoute splices a segment, the endpoint of the left slice
    // can equal the first point of bestRoute, producing a zero-length segment.
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 }, // duplicate at splice junction
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]
    const result = simplifyPath(path)
    // Duplicate removed, path length should be smaller than input
    expect(result.length).toBeLessThan(path.length)
    // No consecutive duplicates in the output
    for (let i = 1; i < result.length; i++) {
      expect(
        result[i].x !== result[i - 1].x || result[i].y !== result[i - 1].y,
      ).toBe(true)
    }
  })

  test("path shorter than 3 points is returned as-is", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    expect(simplifyPath(path)).toEqual(path)
  })
})
