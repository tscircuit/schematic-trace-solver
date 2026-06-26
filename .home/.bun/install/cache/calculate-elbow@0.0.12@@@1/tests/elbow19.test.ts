import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 250,
    y: 300,
    facingDirection: "y-",
  },
  point2: {
    x: 500,
    y: 100,
    facingDirection: "y+",
  },
} as const

test.skip("elbow19", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 250, y: 300 },
    { x: 250, y: 200 },
    { x: 500, y: 200 },
    { x: 500, y: 100 },
  ])
})
