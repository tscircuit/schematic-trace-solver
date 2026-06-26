import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 100,
    y: 100,
    facingDirection: "y-",
  },
  point2: {
    x: 350,
    y: 250,
    facingDirection: "x+",
  },
} as const

test.skip("elbow21", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 100, y: 100 },
    { x: 100, y: 50 },
    { x: 400, y: 50 },
    { x: 400, y: 250 },
    { x: 350, y: 250 },
  ])
})
