import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 200,
    y: 100,
    facingDirection: "x+",
  },
  point2: {
    x: 200,
    y: 300,
    facingDirection: "y-",
  },
} as const

test("elbow16", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 200, y: 100 },
    { x: 250, y: 100 },
    { x: 250, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 300 },
  ])
})
