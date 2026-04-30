import { test, expect } from "bun:test"
import { chipToRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

test("chipToRect creates bounds from chip", () => {
  const chip = {
    chipId: "U1",
    center: { x: 5, y: 5 },
    width: 10,
    height: 10,
    pins: [
      { pinId: "U1.pin1", x: 0, y: 0 },
      { pinId: "U1.pin2", x: 10, y: 0 },
    ],
  } as any

  const result = chipToRect(chip)

  expect(result.chipId).toBe("U1")
  expect(result.minX).toBe(0)
  expect(result.minY).toBe(0)
  expect(result.maxX).toBe(10)
  expect(result.maxY).toBe(10)
})

test("chipToRect handles minimal chip", () => {
  const chip = {
    chipId: "U1",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    pins: [],
  } as any

  const result = chipToRect(chip)

  expect(result.chipId).toBe("U1")
  expect(result.minX).toBe(-0.5)
  expect(result.maxX).toBe(0.5)
})
