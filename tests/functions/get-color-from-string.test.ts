import { expect, test } from "bun:test"
import { getColorFromString } from "lib/utils/getColorFromString"

const getHue = (color: string) => {
  const match = color.match(/^hsl\((\d+), 100%, 50%, [^)]+\)$/)
  expect(match).not.toBeNull()
  return Number(match?.[1])
}

test("preserves existing colors for ordinary identifiers", () => {
  expect(getColorFromString("U1.13-RFSET.1")).toBe("hsl(328, 100%, 50%, 1)")
  expect(getColorFromString("net0", 0.75)).toBe("hsl(195, 100%, 50%, 0.75)")
  expect(getColorFromString("")).toBe("hsl(0, 100%, 50%, 1)")
})

test("returns a valid hue for the reported long string", () => {
  const hue = getHue(getColorFromString("n".repeat(300)))

  expect(hue).toBeGreaterThanOrEqual(0)
  expect(hue).toBeLessThan(360)
})

test("keeps long-string colors deterministic and distinguishable", () => {
  const prefix = "global-connection-".repeat(1_000)
  const firstColor = getColorFromString(`${prefix}a`, 0.35)
  const secondColor = getColorFromString(`${prefix}b`, 0.35)

  expect(getColorFromString(`${prefix}a`, 0.35)).toBe(firstColor)
  expect(getHue(firstColor)).toBeLessThan(360)
  expect(getHue(secondColor)).toBeLessThan(360)
  expect(firstColor).not.toBe(secondColor)
})
