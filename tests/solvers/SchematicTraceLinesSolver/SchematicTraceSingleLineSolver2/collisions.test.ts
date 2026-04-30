import { test, expect } from "bun:test"
import {
  isVertical,
  isHorizontal,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

test("isVertical returns true for vertical segment", () => {
  expect(isVertical({ x: 5, y: 0 }, { x: 5, y: 10 })).toBe(true)
})

test("isVertical returns false for horizontal segment", () => {
  expect(isVertical({ x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false)
})

test("isVertical returns false for diagonal segment", () => {
  expect(isVertical({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe(false)
})

test("isHorizontal returns true for horizontal segment", () => {
  expect(isHorizontal({ x: 0, y: 5 }, { x: 10, y: 5 })).toBe(true)
})

test("isHorizontal returns false for vertical segment", () => {
  expect(isHorizontal({ x: 5, y: 0 }, { x: 5, y: 10 })).toBe(false)
})

test("isHorizontal returns false for diagonal segment", () => {
  expect(isHorizontal({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe(false)
})

test("segmentIntersectsRect returns false for non-axis-aligned segment", () => {
  const result = segmentIntersectsRect(
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  )
  expect(result).toBe(false)
})

test("segmentIntersectsRect returns true for vertical crossing rect", () => {
  const result = segmentIntersectsRect(
    { x: 5, y: 0 },
    { x: 5, y: 10 },
    { minX: 0, minY: 2, maxX: 10, maxY: 8 },
  )
  expect(result).toBe(true)
})
