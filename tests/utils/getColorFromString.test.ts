import { test, expect } from "bun:test"
import { getColorFromString } from "lib/utils/getColorFromString"

test("getColorFromString returns valid HSL string", () => {
  const result = getColorFromString("test")
  expect(result).toMatch(/^hsl\(\d+, 100%, 50%, 1\)$/)
})

test("getColorFromString returns consistent color for same input", () => {
  const result1 = getColorFromString("net1")
  const result2 = getColorFromString("net1")
  expect(result1).toBe(result2)
})

test("getColorFromString returns different colors for different inputs", () => {
  const result1 = getColorFromString("net1")
  const result2 = getColorFromString("net2")
  expect(result1).not.toBe(result2)
})

test("getColorFromString handles alpha parameter", () => {
  const result = getColorFromString("test", 0.5)
  expect(result).toMatch(/^hsl\(\d+, 100%, 50%, 0.5\)$/)
})

test("getColorFromString handles empty string", () => {
  const result = getColorFromString("")
  expect(result).toMatch(/^hsl\(\d+, 100%, 50%, 1\)$/)
})
