import { expect, test } from "bun:test"
import { getColorFromString } from "lib/utils/getColorFromString"

const getHue = (color: string) => {
  const hue = Number(color.match(/^hsl\((\d+),/)?.[1])
  expect(Number.isFinite(hue)).toBe(true)
  return hue
}

test("returns a valid hue for strings whose hash would overflow", () => {
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

test("preserves colors for ordinary identifiers", () => {
  expect(getColorFromString("U1.13-RFSET.1")).toBe("hsl(328, 100%, 50%, 1)")
  expect(getColorFromString("net0", 0.75)).toBe("hsl(195, 100%, 50%, 0.75)")
})
