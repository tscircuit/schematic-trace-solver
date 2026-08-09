import { test, expect } from "bun:test"
import { getColorFromString } from "lib/utils/getColorFromString"

test("getColorFromString returns a valid hue for very long strings", () => {
  // The hash accumulator overflows to Infinity for long strings, which used to
  // produce an invalid `hsl(NaN, 100%, 50%, 1)` color.
  const color = getColorFromString("n".repeat(300))

  expect(color).not.toContain("NaN")
  const hue = Number(color.slice(color.indexOf("(") + 1, color.indexOf(",")))
  expect(Number.isFinite(hue)).toBe(true)
  expect(hue).toBeGreaterThanOrEqual(0)
  expect(hue).toBeLessThan(360)
})

test("getColorFromString is unchanged for normal strings", () => {
  expect(getColorFromString("U1.13-RFSET.1")).toBe("hsl(328, 100%, 50%, 1)")
  expect(getColorFromString("net0", 0.75)).toBe("hsl(195, 100%, 50%, 0.75)")
})
