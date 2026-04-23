import { expect, test, describe } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

describe("simplifyPath", () => {
  test("should return path unchanged if less than 3 points", () => {
    expect(simplifyPath([])).toEqual([])
    expect(simplifyPath([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }])
    expect(
      simplifyPath([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toEqual([
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
    expect(simplifyPath(path)).toEqual([
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
    expect(simplifyPath(path)).toEqual([
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
    expect(simplifyPath(path)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
  })

  test("should remove duplicate consecutive points", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(simplifyPath(path)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("should remove near-duplicate points within epsilon", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1e-10, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(simplifyPath(path)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("should handle path with mixed collinear segments and corners", () => {
    // Simulates the kind of path produced by UntangleTraceSubsolver rerouting
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 }, // collinear with prev two
      { x: 1, y: 2 }, // corner
      { x: 2, y: 2 }, // collinear
      { x: 2, y: 3 }, // corner
    ]
    expect(simplifyPath(path)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ])
  })
})
