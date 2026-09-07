import { expect, test, describe } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

describe("simplifyPath duplicate point removal", () => {
  test("removes consecutive duplicate points in the middle", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ])
  })

  test("removes consecutive duplicate points at the start", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("removes consecutive duplicate points at the end", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("removes multiple consecutive duplicates", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  test("handles zero-length two-point path (both points identical)", () => {
    const path = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ]
    const result = simplifyPath(path)
    expect(result).toEqual([{ x: 5, y: 5 }])
  })

  test("collapses collinear horizontal points", () => {
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

  test("collapses collinear vertical points", () => {
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

  test("handles path with duplicates at direction change", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
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
})
