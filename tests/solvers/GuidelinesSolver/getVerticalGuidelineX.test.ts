import { test, expect } from "bun:test"
import { getVerticalGuidelineX } from "lib/solvers/GuidelinesSolver/getVerticalGuidelineX"

test("getVerticalGuidelineX returns midpoint for separated chips", () => {
  const chip1 = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
  const chip2 = { minX: 20, maxX: 30, minY: 0, maxY: 10 }
  expect(getVerticalGuidelineX(chip1, chip2)).toBe(15) // (10 + 20) / 2
})

test("getVerticalGuidelineX returns midpoint for reversed order", () => {
  const chip1 = { minX: 20, maxX: 30, minY: 0, maxY: 10 }
  const chip2 = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
  expect(getVerticalGuidelineX(chip1, chip2)).toBe(15) // (10 + 20) / 2
})

test("getVerticalGuidelineX returns midpoint for overlapping chips", () => {
  const chip1 = { minX: 0, maxX: 20, minY: 0, maxY: 10 }
  const chip2 = { minX: 10, maxX: 30, minY: 0, maxY: 10 }
  // Overlap: minX=10, maxX=20, midpoint=15
  expect(getVerticalGuidelineX(chip1, chip2)).toBe(15)
})
