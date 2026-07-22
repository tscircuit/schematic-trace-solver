import { describe, expect, test } from "bun:test"
import { getColorFromString } from "../lib/utils/getColorFromString"

describe("getColorFromString", () => {
  test("returns valid HSL for standard strings", () => {
    const color = getColorFromString("net1")
    expect(color).toMatch(/^hsl\(\d+, 100%, 50%, 1\)$/)
  })

  test("returns valid HSL for custom alpha", () => {
    const color = getColorFromString("net1", 0.5)
    expect(color).toMatch(/^hsl\(\d+, 100%, 50%, 0\.5\)$/)
  })

  test("does not overflow to NaN for very long strings", () => {
    const longString = "n".repeat(300)
    const color = getColorFromString(longString)
    expect(color.includes("NaN")).toBe(false)
    expect(color).toMatch(/^hsl\(\d+, 100%, 50%, 1\)$/)
  })
})
