import { test, expect } from "bun:test"
import { getInputChipBounds } from "lib/solvers/GuidelinesSolver/getInputChipBounds"

test("getInputChipBounds calculates correct bounds", () => {
  const chip = {
    chipId: "U1",
    center: { x: 0, y: 0 },
    width: 10,
    height: 6,
    pins: [],
  }

  const result = getInputChipBounds(chip as any)

  expect(result.minX).toBe(-5)
  expect(result.maxX).toBe(5)
  expect(result.minY).toBe(-3)
  expect(result.maxY).toBe(3)
})

test("getInputChipBounds handles offset chip", () => {
  const chip = {
    chipId: "U1",
    center: { x: 10, y: 20 },
    width: 4,
    height: 2,
    pins: [],
  }

  const result = getInputChipBounds(chip as any)

  expect(result.minX).toBe(8)
  expect(result.maxX).toBe(12)
  expect(result.minY).toBe(19)
  expect(result.maxY).toBe(21)
})
