import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 450,
    y: 150,
    facingDirection: "y-",
  },
  point2: {
    x: 350,
    y: 50,
    facingDirection: "x+",
  },
} as const

test("elbow26", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 450, y: 150 },
    { x: 450, y: 50 },
    { x: 350, y: 50 },
  ])
})
