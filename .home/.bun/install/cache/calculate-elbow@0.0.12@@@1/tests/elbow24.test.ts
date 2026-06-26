import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 300,
    y: 50,
    facingDirection: "x-",
  },
  point2: {
    x: 150,
    y: 200,
    facingDirection: "y-",
  },
} as const

test("elbow24", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 300, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 200 },
  ])
})
