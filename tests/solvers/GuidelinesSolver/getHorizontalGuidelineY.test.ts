import { test, expect } from "bun:test"
import { getHorizontalGuidelineY } from "lib/solvers/GuidelinesSolver/getHorizontalGuidelineY"

test("getHorizontalGuidelineY returns midpoint for separated chips", () => {
  const chip1 = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
  const chip2 = { minX: 0, maxX: 10, minY: 20, maxY: 30 }
  expect(getHorizontalGuidelineY(chip1, chip2)).toBe(15)
})

test("getHorizontalGuidelineY returns midpoint for overlapping chips", () => {
  const chip1 = { minX: 0, maxX: 10, minY: 0, maxY: 20 }
  const chip2 = { minX: 0, maxX: 10, minY: 10, maxY: 30 }
  expect(getHorizontalGuidelineY(chip1, chip2)).toBe(15)
})
