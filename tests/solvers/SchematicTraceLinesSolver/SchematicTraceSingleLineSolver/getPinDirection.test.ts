import { test, expect } from "bun:test"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"

test("getPinDirection returns y+ for pin on top edge", () => {
  const chip = {
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
  }
  const pin = { x: 0, y: 5 } // top edge (y+)
  expect(getPinDirection(pin as any, chip as any)).toBe("y+")
})

test("getPinDirection returns y- for pin on bottom edge", () => {
  const chip = {
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
  }
  const pin = { x: 0, y: -5 } // bottom edge (y-)
  expect(getPinDirection(pin as any, chip as any)).toBe("y-")
})

test("getPinDirection returns x+ for pin on right edge", () => {
  const chip = {
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
  }
  const pin = { x: 5, y: 0 } // right edge (x+)
  expect(getPinDirection(pin as any, chip as any)).toBe("x+")
})

test("getPinDirection returns x- for pin on left edge", () => {
  const chip = {
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
  }
  const pin = { x: -5, y: 0 } // left edge (x-)
  expect(getPinDirection(pin as any, chip as any)).toBe("x-")
})
