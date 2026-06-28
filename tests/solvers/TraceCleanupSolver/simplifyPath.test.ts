import { expect, test } from "bun:test"
import type { Point } from "graphics-debug"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

const hasZeroLengthSegment = (path: Point[]) => {
  for (let i = 1; i < path.length; i++) {
    if (path[i].x === path[i - 1].x && path[i].y === path[i - 1].y) return true
  }
  return false
}

const hasCollinearLeftover = (path: Point[]) => {
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1]
    const b = path[i]
    const c = path[i + 1]
    const vertical = a.x === b.x && b.x === c.x
    const horizontal = a.y === b.y && b.y === c.y
    if (vertical || horizontal) return true
  }
  return false
}

test("simplifyPath removes consecutive duplicate points (zero-length segments)", () => {
  // These duplicate points are exactly what UntangleTraceSubsolver._applyBestRoute
  // introduces when it splices a rerouted segment into a trace path. They render
  // as spurious extra trace lines (issue #78).
  const path: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // duplicate
    { x: 1, y: 1 },
  ]
  const result = simplifyPath(path)
  expect(hasZeroLengthSegment(result)).toBe(false)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("simplifyPath removes a duplicate point sitting at a corner", () => {
  // A duplicate adjacent to a turn is NOT collinear with the next distinct point,
  // so the original collinear-only passes left it in place.
  const path: Point[] = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 0 }, // duplicate at the corner
    { x: 2, y: 2 },
  ]
  const result = simplifyPath(path)
  expect(hasZeroLengthSegment(result)).toBe(false)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
  ])
})

test("simplifyPath does not emit a redundant trailing segment when a path doubles back (issue #78 repro)", () => {
  // Minimal reproduction of the "extra trace lines" artifact. The original
  // two-pass implementation returned [(0,0),(-1,0),(-1,0)] for this input -- a
  // zero-length trailing segment that renders as an extra trace line.
  const path: Point[] = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: -2, y: -1 },
    { x: -1, y: -1 },
    { x: -1, y: 0 },
  ]
  const result = simplifyPath(path)
  expect(hasZeroLengthSegment(result)).toBe(false)
  expect(hasCollinearLeftover(result)).toBe(false)
})

test("simplifyPath does not leave a redundant trailing segment", () => {
  // The original implementation pushed the final point unconditionally, so when
  // the second-to-last point was dropped the last point could become collinear
  // with (or identical to) the previous kept point -> an extra trace line.
  const path: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: -1 }, // duplicate
    { x: 0, y: -2 },
    { x: -1, y: -2 },
    { x: 0, y: -2 }, // backtrack onto the previous horizontal line
  ]
  const result = simplifyPath(path)
  expect(hasZeroLengthSegment(result)).toBe(false)
  expect(hasCollinearLeftover(result)).toBe(false)
})

test("simplifyPath removes all collinear points", () => {
  const path: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
  ]
  expect(simplifyPath(path)).toEqual([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
  ])
})

test("simplifyPath preserves genuine turns (L and Z shapes)", () => {
  const lShape: Point[] = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
  ]
  expect(simplifyPath(lShape)).toEqual(lShape)

  const zShape: Point[] = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 4, y: 2 },
  ]
  expect(simplifyPath(zShape)).toEqual(zShape)
})

test("simplifyPath collapses a fully degenerate path to a single point", () => {
  const path: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]
  expect(simplifyPath(path)).toEqual([{ x: 0, y: 0 }])
})
