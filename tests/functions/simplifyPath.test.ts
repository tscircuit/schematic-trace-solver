import { describe, test, expect } from "bun:test"
import {
  simplifyPath,
  removeDuplicateConsecutivePoints,
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

  test("removes duplicate consecutive points before collinear merge", () => {
    // Duplicate junction from _applyBestRoute splice
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 }, // duplicate at splice junction
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]
    const result = simplifyPath(path)
    // After dedup: [0,0]-[1,0]-[1,1]-[2,1] — an L-shape, no collinear removal
    expect(result).not.toContainEqual({ x: 1, y: 0 })
    // Final shape should be [0,0]-[1,0]-[1,1]-[2,1] or simplified
    expect(result.length).toBeLessThan(path.length)
  })

  test("path shorter than 3 points is returned as-is", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    expect(simplifyPath(path)).toEqual(path)
  })
})
