import { test, expect, describe } from "bun:test"
import {
  removeDuplicateConsecutivePoints,
  simplifyPath,
} from "lib/solvers/TraceCleanupSolver/simplifyPath"

describe("removeDuplicateConsecutivePoints", () => {
  test("empty path returns empty", () => {
    expect(removeDuplicateConsecutivePoints([])).toEqual([])
  })

  test("single point returns same", () => {
    expect(removeDuplicateConsecutivePoints([{ x: 1, y: 2 }])).toEqual([
      { x: 1, y: 2 },
    ])
  })

  test("no duplicates returns same path", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(removeDuplicateConsecutivePoints(path)).toEqual(path)
  })

  test("removes consecutive duplicates", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(removeDuplicateConsecutivePoints(path)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("removes multiple consecutive duplicates", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ]
    expect(removeDuplicateConsecutivePoints(path)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("removes near-duplicates within epsilon", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1 + 1e-12, y: 0 + 1e-12 },
      { x: 2, y: 0 },
    ]
    expect(removeDuplicateConsecutivePoints(path)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
  })
})

describe("simplifyPath with duplicates", () => {
  test("simplifyPath handles consecutive duplicates gracefully", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]
    const result = simplifyPath(path)
    for (let i = 1; i < result.length; i++) {
      const same =
        Math.abs(result[i].x - result[i - 1].x) < 1e-9 &&
        Math.abs(result[i].y - result[i - 1].y) < 1e-9
      expect(same).toBe(false)
    }
  })

  test("simplifyPath still removes collinear midpoints", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ])
  })
})
