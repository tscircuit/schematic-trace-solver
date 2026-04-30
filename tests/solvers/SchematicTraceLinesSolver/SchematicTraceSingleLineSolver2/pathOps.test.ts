import { test, expect } from "bun:test"
import { shiftSegmentOrth } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/pathOps"

test("shiftSegmentOrth returns null for invalid segIndex", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]
  const result = shiftSegmentOrth(pts, -1, "x", 5)
  expect(result).toBeNull()
})

test("shiftSegmentOrth returns null for last point", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]
  const result = shiftSegmentOrth(pts, 1, "x", 5)
  expect(result).toBeNull()
})

test("shiftSegmentOrth returns null for diagonal segment", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ]
  const result = shiftSegmentOrth(pts, 0, "x", 5)
  expect(result).toBeNull()
})

test("shiftSegmentOrth shifts vertical segment on x axis", () => {
  const pts = [
    { x: 5, y: 0 },
    { x: 5, y: 10 },
  ]
  const result = shiftSegmentOrth(pts, 0, "x", 15)
  expect(result).not.toBeNull()
  expect(result![0].x).toBe(15)
})

test("shiftSegmentOrth shifts horizontal segment on y axis", () => {
  const pts = [
    { x: 0, y: 5 },
    { x: 10, y: 5 },
  ]
  const result = shiftSegmentOrth(pts, 0, "y", 15)
  expect(result).not.toBeNull()
  expect(result![0].y).toBe(15)
})

test("shiftSegmentOrth returns null when axis doesn't match segment", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ] // horizontal
  const result = shiftSegmentOrth(pts, 0, "x", 5) // but x axis
  expect(result).toBeNull()
})
