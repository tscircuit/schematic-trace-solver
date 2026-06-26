import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 250,
    y: 350,
    facingDirection: "x-",
  },
  point2: {
    x: 450,
    y: 250,
    facingDirection: "y-",
  },
} as const

test("elbow33", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    {
      x: 250,
      y: 350,
    },
    {
      x: 200,
      y: 350,
    },
    {
      x: 200,
      y: 200,
    },
    {
      x: 450,
      y: 200,
    },
    {
      x: 450,
      y: 250,
    },
  ])
})
