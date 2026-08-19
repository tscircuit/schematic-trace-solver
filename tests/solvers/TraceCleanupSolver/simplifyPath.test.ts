import { describe, expect, test } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

describe("simplifyPath post-processing", () => {
  test("removes redundant intermediate collinear horizontal and vertical points", () => {
    const rawPath = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 3 },
      { x: 10, y: 7 },
      { x: 10, y: 12 },
    ]
    const simplified = simplifyPath(rawPath)
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 12 },
    ])
  })

  test("deduplicates consecutive identical points across complex routes", () => {
    const rawPath = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 5 },
    ]
    const simplified = simplifyPath(rawPath)
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 5 },
    ])
  })

  test("handles empty and short paths gracefully", () => {
    expect(simplifyPath([])).toEqual([])
    expect(simplifyPath([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }])
    expect(
      simplifyPath([
        { x: 1, y: 2 },
        { x: 1, y: 2 },
      ]),
    ).toEqual([{ x: 1, y: 2 }])
    expect(
      simplifyPath([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
  })

  test("simplifies complex zigzag routes with intermediate redundant segments", () => {
    const complexRoute = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 4, y: 6 },
      { x: 8, y: 6 },
      { x: 12, y: 6 },
      { x: 12, y: 10 },
    ]
    const simplified = simplifyPath(complexRoute)
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 6 },
      { x: 12, y: 6 },
      { x: 12, y: 10 },
    ])
  })

  test("prunes collinear points with diagonal segments", () => {
    const diagonalCollinear = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 4 },
      { x: 6, y: 6 },
      { x: 10, y: 6 },
    ]
    const simplified = simplifyPath(diagonalCollinear)
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 6 },
      { x: 10, y: 6 },
    ])
  })
})
