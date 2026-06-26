import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 200,
    y: 100,
    facingDirection: "x-",
  },
  point2: {
    x: 450,
    y: 250,
    facingDirection: "y-",
  },
} as const

test("elbow32", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    {
      x: 200,
      y: 100,
    },
    {
      x: 150,
      y: 100,
    },
    {
      x: 150,
      y: 175,
    },
    {
      x: 450,
      y: 175,
    },
    {
      x: 450,
      y: 250,
    },
  ])
})
