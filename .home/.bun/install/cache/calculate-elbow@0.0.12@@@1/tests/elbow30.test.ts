import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 350,
    y: 100,
    facingDirection: "x+",
  },
  point2: {
    x: 100,
    y: 300,
    facingDirection: "y-",
  },
} as const

test("elbow30", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 350, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 200 },
    { x: 100, y: 200 },
    { x: 100, y: 300 },
  ])
})
