import { test, expect } from "bun:test"
import {
  EPS,
  isTraceLine,
  rectsOverlap,
  tracePathContainsPoint,
} from "lib/solvers/VccNetLabelCornerPlacementSolver/geometry"

test("EPS is defined", () => {
  expect(EPS).toBe(1e-6)
})

test("isTraceLine returns true for trace with multiple unique pins", () => {
  const trace = {
    pinIds: ["pin1", "pin2", "pin3"],
  }
  expect(isTraceLine(trace as any)).toBe(true)
})

test("isTraceLine returns false for trace with single pin", () => {
  const trace = {
    pinIds: ["pin1"],
  }
  expect(isTraceLine(trace as any)).toBe(false)
})

test("rectsOverlap returns true for overlapping rects", () => {
  const a = { minX: 0, minY: 0, maxX: 5, maxY: 5 }
  const b = { minX: 3, minY: 3, maxX: 8, maxY: 8 }
  expect(rectsOverlap(a, b)).toBe(true)
})

test("rectsOverlap returns false for non-overlapping rects", () => {
  const a = { minX: 0, minY: 0, maxX: 5, maxY: 5 }
  const b = { minX: 10, minY: 10, maxX: 15, maxY: 15 }
  expect(rectsOverlap(a, b)).toBe(false)
})

test("tracePathContainsPoint returns true when point is on path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]
  const point = { x: 5, y: 0 }
  expect(tracePathContainsPoint(path, point)).toBe(true)
})

test("tracePathContainsPoint returns false when point is not on path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]
  const point = { x: 50, y: 50 }
  expect(tracePathContainsPoint(path, point)).toBe(false)
})
