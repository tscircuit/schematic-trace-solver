import { test, expect } from "bun:test"
import {
  isYOrientation,
  isXOrientation,
  rectsOverlap,
  rangesOverlap,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"

test("isYOrientation returns true for y+", () => {
  expect(isYOrientation("y+")).toBe(true)
})

test("isYOrientation returns true for y-", () => {
  expect(isYOrientation("y-")).toBe(true)
})

test("isYOrientation returns false for x+", () => {
  expect(isYOrientation("x+")).toBe(false)
})

test("isYOrientation returns false for x-", () => {
  expect(isYOrientation("x-")).toBe(false)
})

test("isXOrientation returns true for x+", () => {
  expect(isXOrientation("x+")).toBe(true)
})

test("isXOrientation returns true for x-", () => {
  expect(isXOrientation("x-")).toBe(true)
})

test("isXOrientation returns false for y+", () => {
  expect(isXOrientation("y+")).toBe(false)
})

test("isXOrientation returns false for y-", () => {
  expect(isXOrientation("y-")).toBe(false)
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

test("rangesOverlap returns true for overlapping ranges", () => {
  expect(rangesOverlap(0, 5, 3, 8)).toBe(true)
})

test("rangesOverlap returns false for non-overlapping ranges", () => {
  expect(rangesOverlap(0, 5, 10, 15)).toBe(false)
})
