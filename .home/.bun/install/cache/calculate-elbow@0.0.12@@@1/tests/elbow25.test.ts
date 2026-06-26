import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 150,
    y: 300,
    facingDirection: "y-",
  },
  point2: {
    x: 300,
    y: 200,
    facingDirection: "x-",
  },
} as const

test("elbow25", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    {
      x: 150,
      y: 300,
    },
    {
      x: 150,
      y: 200,
    },
    {
      x: 300,
      y: 200,
    },
  ])
})
