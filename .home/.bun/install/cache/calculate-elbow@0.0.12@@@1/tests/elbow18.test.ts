import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

export const scene = {
  point1: {
    x: 200,
    y: 200,
    facingDirection: "x-",
  },
  point2: {
    x: 350,
    y: 100,
    facingDirection: "y-",
  },
} as const

test.skip("elbow18", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 200, y: 200 },
    { x: 150, y: 200 }, // go left 50
    { x: 150, y: 50 }, // down to y=50
    { x: 350, y: 50 }, // then to x=350
    { x: 350, y: 100 },
  ])
})
