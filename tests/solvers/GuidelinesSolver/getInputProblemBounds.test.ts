import { test, expect } from "bun:test"
import { getInputProblemBounds } from "lib/solvers/GuidelinesSolver/getInputProblemBounds"

test("getInputProblemBounds returns correct bounds", () => {
  const problem = {
    chips: [
      {
        chipId: "1",
        center: { x: 0, y: 0 },
        width: 10,
        height: 10,
        pins: [],
      },
    ],
    traces: [],
    netLabels: [],
  }
  const bounds = getInputProblemBounds(problem as any)
  expect(bounds.minX).toBe(-5)
  expect(bounds.maxX).toBe(5)
  expect(bounds.minY).toBe(-5)
  expect(bounds.maxY).toBe(5)
})

test("getInputProblemBounds returns Infinity for empty problem", () => {
  const problem = { chips: [], traces: [], netLabels: [] }
  const bounds = getInputProblemBounds(problem as any)
  expect(bounds.minX).toBe(Infinity)
  expect(bounds.maxX).toBe(-Infinity)
})
