import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: -1.15,
    y: 0.30000000000000004,
    facingDirection: "x-",
  },
  point2: {
    x: -1.1500000000000004,
    y: 1.15,
    facingDirection: "y-",
  },
} as const

test("repro01", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 0.2,
  })
  expect(result).toEqual([
    {
      x: -1.15,
      y: 0.30000000000000004,
    },
    {
      x: -1.3499999999999999,
      y: 0.30000000000000004,
    },
    {
      x: -1.3499999999999999,
      y: 0.7250000000000001,
    },
    {
      x: -1.1500000000000004,
      y: 0.7250000000000001,
    },
    {
      x: -1.1500000000000004,
      y: 1.15,
    },
  ])
})
