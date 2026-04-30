import { test, expect } from "bun:test"
import { getColorFromString } from "lib/utils/getColorFromString"

test("getColorFromString returns valid HSL color", () => {
  const result = getColorFromString("test")
  expect(result).toMatch(/^hsl\(\d+, 100%, 50%, 1\)$/)
})

test("getColorFromString returns same color for same input", () => {
  const result1 = getColorFromString("test")
  const result2 = getColorFromString("test")
  expect(result1).toBe(result2)
})

test("getColorFromString returns different colors for different inputs", () => {
  const result1 = getColorFromString("test1")
  const result2 = getColorFromString("test2")
  expect(result1).not.toBe(result2)
})

test("getColorFromString accepts alpha parameter", () => {
  const result = getColorFromString("test", 0.5)
  expect(result).toMatch(/^hsl\(\d+, 100%, 50%, 0\.5\)$/)
})

test("getColorFromString uses alpha=1 by default", () => {
  const result = getColorFromString("test")
  expect(result).toContain(", 1)")
})
