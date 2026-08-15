import { test, expect } from "bun:test"
import { getColorFromString } from "lib/utils/getColorFromString"

test("getColorFromString handles very long strings without producing NaN (#651)", () => {
  const longString = "n".repeat(300)
  const color = getColorFromString(longString)

  expect(color).not.toContain("NaN")
  expect(color).toMatch(/^hsl\(\d+, 100%, 50%, 1\)$/)
})

test("getColorFromString generates valid colors with custom alpha and non-negative hues", () => {
  const color = getColorFromString("my-test-net-id", 0.5)
  expect(color).not.toContain("NaN")
  expect(color).toMatch(/^hsl\(\d+, 100%, 50%, 0\.5\)$/)
})
