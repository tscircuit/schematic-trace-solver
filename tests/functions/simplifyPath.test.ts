import { expect, test, describe } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

describe("simplifyPath", () => {
  test("should return path unchanged if less than 3 points", () => {
    expect(simplifyPath([])).toEqual([])
    expect(simplifyPath([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }])
    expect(simplifyPath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("should remove collinear horizontal points", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  test("should remove collinear vertical points", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 3 },
    ])
  })

  test("should preserve L-shaped corners", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
  })

  test("should handle Z-shape correctly", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
  })

  test("should remove duplicate consecutive points", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 0 }, // duplicate
      { x: 1, y: 0 },
      { x: 1, y: 0 }, // duplicate
      { x: 1, y: 1 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("should remove near-duplicate consecutive points (within epsilon)", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1e-10, y: 1e-10 }, // near-duplicate
      { x: 1, y: 0 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
  })

  test("should handle complex path with duplicates and collinear points", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 0 }, // duplicate
      { x: 1, y: 0 },
      { x: 2, y: 0 }, // collinear with previous
      { x: 2, y: 1 },
      { x: 2, y: 2 }, // collinear with previous
      { x: 2, y: 2 }, // duplicate
      { x: 3, y: 2 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ])
  })
})
