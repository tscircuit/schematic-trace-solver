import { test, expect } from "bun:test"
import {
  getPathKey,
  getPathLength,
  getDistance,
  isAxisAlignedSegment,
  getSegmentOrientation,
} from "lib/solvers/Example28Solver/geometry"

test("getPathKey creates consistent key", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 5, y: 5 },
  ]
  const key1 = getPathKey(path)
  const key2 = getPathKey(path)
  expect(key1).toBe(key2)
  expect(key1).toBe("0,0;5,5")
})

test("getPathLength calculates Manhattan distance", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]
  expect(getPathLength(path)).toBe(20) // 10 + 10
})

test("getPathLength returns 0 for single point", () => {
  const path = [{ x: 5, y: 5 }]
  expect(getPathLength(path)).toBe(0)
})

test("getDistance calculates Manhattan distance", () => {
  expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
  expect(getDistance({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10)
})

test("isAxisAlignedSegment returns true for horizontal", () => {
  expect(isAxisAlignedSegment({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true)
})

test("isAxisAlignedSegment returns true for vertical", () => {
  expect(isAxisAlignedSegment({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(true)
})

test("isAxisAlignedSegment returns false for diagonal", () => {
  expect(isAxisAlignedSegment({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false)
})

test("getSegmentOrientation returns horizontal", () => {
  expect(getSegmentOrientation({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(
    "horizontal",
  )
})

test("getSegmentOrientation returns vertical", () => {
  expect(getSegmentOrientation({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(
    "vertical",
  )
})
