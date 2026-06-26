import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 50,
    y: 200,
    facingDirection: "y+",
  },
  point2: {
    x: 200,
    y: 50,
    facingDirection: "x+",
  },
} as const

test.skip("elbow13", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 50, y: 200 },
    { x: 50, y: 250 },
    { x: 250, y: 250 },
    { x: 250, y: 50 },
    { x: 200, y: 50 },
  ])
})
